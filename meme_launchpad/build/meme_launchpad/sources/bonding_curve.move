module meme_launchpad::bonding_curve {
    use sui::balance;
    use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
    use meme_launchpad::safe_math;
    use meme_launchpad::safe_math_u256;
    use meme_launchpad::meme_token::{MEME_TOKEN};
    use meme_launchpad::create_pool::{init_cetus_pool};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Clock};
    use cetus_clmm::pool_creator::{create_pool_v2};
    use cetus_clmm::config::GlobalConfig;
    use cetus_clmm::tick_math::get_sqrt_price_at_tick;
    use std::string::{Self};
    use integer_mate::i32::{Self};

    const BASE_PRICE: u64 = 10_000;
    const SLOPE: u64 = 100;
    const FIXED_POINT_SCALE: u256 = 1_000_000_000;
    const E_OVERFLOW: u64 = 1;
    const E_INSUFFICIENT_SUI: u64 = 3;
    const E_AMOUNT_TOO_LARGE: u64 = 4;
    const E_RESULT_TOO_LARGE: u64 = 5;
    const E_INSUFFICIENT_FTOKEN: u64 = 7;
    const E_INVALID_AMOUNT: u64 = 6;
    const E_POOL_ALREADY_CREATED: u64 = 8;
    const U64_MAX: u64 = 18_446_744_073_709_551_615;
    const POOL_CREATION_THRESHOLD: u64 = 1_200_000_000; // 1.2 SUI in mist
    const FEE_TIER: u32 = 60; // 0.25% fee tier (tick spacing)
    const FIX_AMOUNT_A: bool = true; // Fix SUI amount
    const POOL_URL: vector<u8> = b""; // Empty URL
    const TICK_RANGE: u32 = 600; // ~10% price range
    const MIN_TICK: u32 = 443636; // Absolute value of minimum tick
    const MAX_TICK: u32 = 443636; // Maximum tick
    const INITIAL_MEME_AMOUNT: u64 = 120_000_000_000_000;
    const INITIAL_SUI_AMOUNT: u64 = 1_000_000_000;
    const TRADE_FEE: bool = false;

    // Event definitions
    public struct BuyTokensEvent has copy, drop {
        amount: u64,
        required_payment: u64,
        total_minted: u64,
        sender: address,
    }

    public struct SellTokensEvent has copy, drop {
        amount: u64,
        refund_amount: u64,
        total_minted: u64,
        sender: address,
        treasury_balance: u64,
    }

    public struct PoolCreatedEvent has copy, drop {
        pool_id: address,
        base_token_amount: u64,
        quote_token_amount: u64,
        sender: address,
    }

    public struct BondingCurve<phantom T> has key, store{
        id: UID,
        total_minted: u256,
        treasury: TreasuryCap<T>,
        sui_treasury: Coin<SUI>,
        pool_created: bool,
        pool_id: Option<address>,
        admin: address,
        fee_bps: u64,
    }

    public struct Cal_event has copy, drop {
        amount: u64,
    }

    public entry fun create_bonding_curve(
        treasury: TreasuryCap<MEME_TOKEN>,
        fee_bps: u64,
        ctx: &mut TxContext,
    ) {
        let zero_balance = balance::zero<SUI>();
        let zero_coin = coin::from_balance(zero_balance, ctx);

        let bonding_curve = BondingCurve<MEME_TOKEN> {
            id: object::new(ctx),
            total_minted: 0,
            treasury,
            sui_treasury: zero_coin,
            pool_created: false,
            pool_id: option::none(),
            admin: @admin,
            fee_bps: fee_bps,
        };

        transfer::public_share_object(bonding_curve)
    }

    public fun calculate_buy_price(
        total_minted: u256,
        amount: u256,
    ): u64 {
        if (amount == 0) {
            return 0
        };

        assert!(amount <= (U64_MAX as u256), E_AMOUNT_TOO_LARGE);
        assert!(total_minted <= (U64_MAX as u256), E_AMOUNT_TOO_LARGE);

        let total_minted_whole_tokens = total_minted / FIXED_POINT_SCALE;
        assert!(total_minted_whole_tokens <= (100_000_000 as u256), E_AMOUNT_TOO_LARGE);

        let mut maybe_price = safe_math_u256::checked_mul(total_minted_whole_tokens, (SLOPE as u256));
        if (!option::is_some(&maybe_price)) {
            abort E_OVERFLOW
        };
        let price = option::extract(&mut maybe_price);

        let mut maybe_total_price = safe_math_u256::checked_add(price, (BASE_PRICE as u256));
        if (!option::is_some(&maybe_total_price)) {
            abort E_OVERFLOW
        };
        let total_price = option::extract(&mut maybe_total_price);

        let mut maybe_cost = safe_math_u256::checked_mul(amount, total_price);
        if (!option::is_some(&maybe_cost)) {
            abort E_OVERFLOW
        };
        let cost = option::extract(&mut maybe_cost);

        let mut maybe_result = safe_math_u256::checked_div(cost, FIXED_POINT_SCALE);
        if (!option::is_some(&maybe_result)) {
            abort E_OVERFLOW
        };
        let result = option::extract(&mut maybe_result);

        if (result > (U64_MAX as u256)) {
            abort E_RESULT_TOO_LARGE
        };

        event::emit(Cal_event {
            amount: result as u64,
        });  // remove after use

        (result as u64)
    }

    public fun calculate_sell_price(
        total_minted: u256,
        amount: u256,
    ): u64 {
        assert!(amount <= (U64_MAX as u256), E_AMOUNT_TOO_LARGE);
        assert!(total_minted <= (U64_MAX as u256), E_AMOUNT_TOO_LARGE);

        let start_minted = total_minted - amount;
        let start_whole_tokens = start_minted / FIXED_POINT_SCALE;

        let mut maybe_start_price = safe_math_u256::checked_mul(start_whole_tokens, (SLOPE as u256));
        if (!option::is_some(&maybe_start_price)) {
            abort E_OVERFLOW
        };
        let start_price = option::extract(&mut maybe_start_price);

        let mut maybe_start_total = safe_math_u256::checked_add(start_price, (BASE_PRICE as u256));
        if (!option::is_some(&maybe_start_total)) {
            abort E_OVERFLOW
        };
        let start_total = option::extract(&mut maybe_start_total);

        let mut maybe_refund = safe_math_u256::checked_mul(amount, start_total);
        if (!option::is_some(&maybe_refund)) {
            abort E_OVERFLOW
        };
        let refund = option::extract(&mut maybe_refund);

        let mut maybe_result = safe_math_u256::checked_div(refund, FIXED_POINT_SCALE);
        if (!option::is_some(&maybe_result)) {
            abort E_OVERFLOW
        };
        let result = option::extract(&mut maybe_result);

        if (result > (U64_MAX as u256)) {
            abort E_RESULT_TOO_LARGE
        };
        (result as u64)
    }

    fun try_create_pool(
        curve: &mut BondingCurve<MEME_TOKEN>,
        config: &GlobalConfig,
        pools: &mut cetus_clmm::factory::Pools,
        clock: &Clock,
        metadata_sui: &CoinMetadata<SUI>,
        metadata_token: &CoinMetadata<MEME_TOKEN>,
        ctx: &mut TxContext,
    ) {
        if (curve.pool_created) {
            return
        };

        let sui_balance = coin::value(&curve.sui_treasury);
        if (sui_balance < POOL_CREATION_THRESHOLD) {
            return
        };

        let meme_tokens = coin::mint(&mut curve.treasury, INITIAL_MEME_AMOUNT, ctx);
        let sui_to_pool = coin::split(&mut curve.sui_treasury, INITIAL_SUI_AMOUNT, ctx);

        let success = init_cetus_pool(
            curve.admin,
            sui_to_pool,
            meme_tokens,
            pools,
            config,
            metadata_sui,
            metadata_token,
            clock,
            ctx
        );

        if (success == true) {
            curve.pool_created = true;
        };
        
    }

    public entry fun buy_tokens(
        curve: &mut BondingCurve<MEME_TOKEN>,
        mut payment: Coin<SUI>,
        amount: u256,
        config: &GlobalConfig,
        pools: &mut cetus_clmm::factory::Pools,
        clock: &Clock,
        metadata_sui: &CoinMetadata<SUI>,
        metadata_meme: &CoinMetadata<MEME_TOKEN>,
        ctx: &mut TxContext,
    ) {
        let amount_u64 = (amount as u64);
        assert!(amount <= (U64_MAX as u256), E_AMOUNT_TOO_LARGE);

        let required_payment = calculate_buy_price(curve.total_minted, amount);
        let payment_value = coin::value(&payment);

        // -------- Fee calculation --------

        let mut maybe_fee = safe_math::checked_mul(required_payment, curve.fee_bps);
        if (!option::is_some(&maybe_fee)) {
            abort E_OVERFLOW;
        };
        let fee = option::extract(&mut maybe_fee) / 10_000;

        let total_required = required_payment + fee;
        assert!(payment_value >= total_required, E_INSUFFICIENT_SUI);

        // Transfer fee to admin
        let admin_fee = coin::split(&mut payment, fee, ctx);
        transfer::public_transfer(admin_fee, curve.admin);

        let coins = coin::mint(&mut curve.treasury, amount_u64, ctx);
        transfer::public_transfer(coins, tx_context::sender(ctx));

        curve.total_minted = curve.total_minted + amount;

        event::emit(BuyTokensEvent {
            amount: amount_u64,
            required_payment,
            total_minted: (curve.total_minted as u64),
            sender: tx_context::sender(ctx),
        });

        if (payment_value > required_payment) {
            let mut refund = safe_math::checked_sub(payment_value, total_required);
            if (!option::is_some(&refund)) {
                abort E_OVERFLOW
            };
            let refund_amount = option::extract(&mut refund);
            let refund = coin::split(&mut payment, refund_amount, ctx);
            transfer::public_transfer(refund, tx_context::sender(ctx));
        };

        coin::join(&mut curve.sui_treasury, payment);

        try_create_pool(curve, config, pools, clock, metadata_sui, metadata_meme, ctx);
    }

    public entry fun sell_tokens(
        curve: &mut BondingCurve<MEME_TOKEN>,
        tokens: &mut Coin<MEME_TOKEN>,
        amount: u256,
        config: &GlobalConfig,
        pools: &mut cetus_clmm::factory::Pools,
        clock: &Clock,
        metadata_sui: &CoinMetadata<SUI>,
        metadata_meme: &CoinMetadata<MEME_TOKEN>,
        ctx: &mut TxContext,
    ) {
        let amount_u64 = (amount as u64);
        let token_value = coin::value(tokens);
        assert!(token_value >= amount_u64, E_INSUFFICIENT_FTOKEN);
        assert!(amount % (1_000_000_000 as u256) == 0, E_INVALID_AMOUNT);

        let refund_amount = calculate_sell_price(curve.total_minted, amount);
        assert!(coin::value(&curve.sui_treasury) >= refund_amount, E_INSUFFICIENT_SUI);

        let tokens_to_burn = coin::split(tokens, amount_u64, ctx);
        coin::burn(&mut curve.treasury, tokens_to_burn);
        curve.total_minted = curve.total_minted - amount;

        let mut refund_coin = coin::split(&mut curve.sui_treasury, refund_amount, ctx);

        // -------- Fee calculation --------

        let mut maybe_fee = safe_math::checked_mul(refund_amount, curve.fee_bps);
        if (!option::is_some(&maybe_fee)) {
            abort E_OVERFLOW;
        };
        let fee = option::extract(&mut maybe_fee) / 10_000;

        assert!(coin::value(&refund_coin) >= fee, E_INSUFFICIENT_SUI);

        let admin_fee = coin::split(&mut refund_coin, fee, ctx);
        transfer::public_transfer(admin_fee, curve.admin);


        event::emit(SellTokensEvent {
            amount: amount_u64,
            refund_amount,
            total_minted: (curve.total_minted as u64),
            sender: tx_context::sender(ctx),
            treasury_balance: coin::value(&curve.sui_treasury),
        });

        transfer::public_transfer(refund_coin, tx_context::sender(ctx));

    }

    public entry fun set_fee_bps(
        curve: &mut BondingCurve<MEME_TOKEN>,
        new_fee_bps: u64,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(caller == curve.admin, E_INVALID_AMOUNT);
        assert!(new_fee_bps <= 10_000, E_INVALID_AMOUNT);

        curve.fee_bps = new_fee_bps;
    }

    public entry fun change_admin(
        curve: &mut BondingCurve<MEME_TOKEN>,
        new_admin: address,
        ctx: &mut TxContext,
    ) {
        let caller = tx_context::sender(ctx);
        assert!(caller == curve.admin, E_INVALID_AMOUNT);
        assert!(new_admin != @0x0, E_INVALID_AMOUNT);
        curve.admin = new_admin;
    }

}