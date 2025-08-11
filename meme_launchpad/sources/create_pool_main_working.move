module meme_launchpad::create_pool {
    use sui::coin::{Self, Coin, CoinMetadata};
    use sui::sui::SUI;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::object::{Self, UID};
    use sui::clock::Clock;
    use sui::event;
    use cetus_clmm::pool_creator::create_pool_v2;
    use cetus_clmm::config::GlobalConfig;
    use cetus_clmm::position::Position;
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use meme_launchpad::meme_token::{Self, MEME_TOKEN};
    use sui::url::{Self, Url};
    use std::ascii;

    // Constants
    const INITIAL_MEME_AMOUNT: u64 = 40_000_000_000_000;
    const INITIAL_SUI_AMOUNT: u64 = 1_000_000_000;
    const E_INSUFFICIENT_AMOUNT: u64 = 2;
    const E_INVALID_FEE: u64 = 5;
    const MIN_TICK: u32 = 4294523696; // Tick -22140
    const MAX_TICK: u32 = 443600;     // Tick +21000

    // Pool struct to store pool data
    public struct Pool<phantom Token> has key, store {
        id: UID,
    }

    // Event for pool creation
    public struct PoolCreatedEvent has copy, drop {
        pool_id: address,
        sui_amount: u64,
        meme_amount: u64,
        sender: address,
    }

    // Initialize a new Pool object
    public entry fun init_pool<Token>(ctx: &mut TxContext) {
        let pool = Pool<Token> {
            id: object::new(ctx),
        };
        transfer::share_object(pool);
    }

    // Init Cetus CLMM Pool
    public entry fun init_cetus_pool(
        admin: address,
        mut coin_sui: Coin<SUI>,
        mut coin_token: Coin<MEME_TOKEN>,
        cetus_pools: &mut cetus_clmm::factory::Pools,
        cetus_config: &GlobalConfig,
        metadata_sui: &CoinMetadata<SUI>,
        metadata_token: &CoinMetadata<MEME_TOKEN>,
        clock: &Clock,
        ctx: &mut TxContext
    ): bool {
        // Hardcoded parameters
        let fee: u32 = 200; // 0.3%
        let initial_price: u128 = 92_233_720_368_547_760; // MEME_TOKEN price in SUI terms
        // let initial_price: u128 = 63901395939770060; // MEME_TOKEN price in SUI terms
        let fix_amount_a: bool = true; // MEME_TOKEN is Token A

        // Verify amounts
        assert!(coin::value(&coin_sui) >= INITIAL_SUI_AMOUNT, E_INSUFFICIENT_AMOUNT);
        assert!(coin::value(&coin_token) >= INITIAL_MEME_AMOUNT, E_INSUFFICIENT_AMOUNT);

        // Validate fee
        assert!(fee == 100 || fee == 200 || fee == 500 || fee == 3000, E_INVALID_FEE);

        // Split liquidity
        let sui_liquidity = coin::split(&mut coin_sui, INITIAL_SUI_AMOUNT, ctx);
        let meme_liquidity = coin::split(&mut coin_token, INITIAL_MEME_AMOUNT, ctx);

        // Optional icon URL – left empty
        let url = string::utf8(b"");

        // Correct token order: MEME_TOKEN < SUI
        let (position, unused_meme, unused_sui) = create_pool_v2<MEME_TOKEN, SUI>(
            cetus_config,
            cetus_pools,
            fee,
            initial_price,
            url,
            MIN_TICK,
            MAX_TICK,
            meme_liquidity,
            sui_liquidity,
            metadata_token,
            metadata_sui,
            fix_amount_a,
            clock,
            ctx
        );

        // Transfer position to admin
        transfer::public_transfer(position, admin);

        // Track unused coin values
        let unused_sui_value = coin::value(&unused_sui);
        let unused_meme_value = coin::value(&unused_meme);

        // Return unused coins
        if (unused_sui_value > 0) {
            transfer::public_transfer(unused_sui, admin);
        } else {
            coin::destroy_zero(unused_sui);
        };

        if (unused_meme_value > 0) {
            transfer::public_transfer(unused_meme, admin);
        } else {
            coin::destroy_zero(unused_meme);
        };

        // Return leftovers from split
        if (coin::value(&coin_sui) > 0) {
            transfer::public_transfer(coin_sui, admin);
        } else {
            coin::destroy_zero(coin_sui);
        };

        if (coin::value(&coin_token) > 0) {
            transfer::public_transfer(coin_token, admin);
        } else {
            coin::destroy_zero(coin_token);
        };

        // Emit event
        event::emit(PoolCreatedEvent {
            pool_id: object::id_address(cetus_pools),
            sui_amount: INITIAL_SUI_AMOUNT - unused_sui_value,
            meme_amount: INITIAL_MEME_AMOUNT - unused_meme_value,
            sender: tx_context::sender(ctx),
        });

        return true
    }
}
