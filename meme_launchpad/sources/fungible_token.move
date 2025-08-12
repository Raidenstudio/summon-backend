// This is a simple fungible token contract in move which is designed in a erc20 standard functionalities init

module meme_launchpad::meme_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{sender};
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::url;
    use std::string::{Self, String};

    // The type of the fungible token
    public struct MEME_TOKEN has drop {}

    public struct AdminCap has key, store {
        id: UID,
    }

    // Maximum supply of the token
    const MAX_SUPPLY: u64 = 1000000000; // 100 million with decimal of 9
    const ICON_URL: vector<u8> = b"https://raidenimage.blob.core.windows.net/raidenimg/2025-08-12T16-28-22.031Z-9eaaf7cdd6575d49abbc56a8547ecbb1.jpg";
    const DECIMALS: u8 = 9;
    const NAME: vector<u8> = b"demoNew";
    const SYMBOL: vector<u8> = b"DE";
    const DESCRIPTION: vector<u8> = b"Gems Stone";

    const EEXCEEDS_SUPPLY: u64 = 0;
    const EINVALID_AMOUNT: u64 = 1;

    // Custom event for token creation
    public struct TokenCreatedEvent has copy, drop {
        name: String,
        symbol: String,
        decimals: u8,
        max_supply: u64,
    }

    // Custom event for minting tokens
    public struct MintEvent has copy, drop {
        amount: u64,
        recipient: address
    }

    public struct TransferCoinEvent has copy, drop {
        from: address,
        to: address,
        amount: u64
    }

    // Custom event for burning tokens
    public struct BurnEvent has copy, drop {
        amount: u64,
        burner: address
    }

    // Custom event for treasury cap transfer
    public struct TreasuryCapTransferred has copy, drop {
        previous_owner: address,
        new_owner: address,
        timestamp: u64,
    }

    // Custom event for AdminCap transfer
    public struct AdminCapTransferred has copy, drop {
        previous_owner: address,
        new_owner: address,
        timestamp: u64,
    }

    fun init(witness: MEME_TOKEN, ctx: &mut TxContext) {
        init_internal(witness, ctx)
    }

    // Module initialization function
    public fun init_internal(witness: MEME_TOKEN, ctx: &mut TxContext) {

        let (treasury_cap, metadata) = coin::create_currency<MEME_TOKEN>(
            witness,
            DECIMALS,
            SYMBOL,
            NAME,
            DESCRIPTION,
            option::some(url::new_unsafe_from_bytes(ICON_URL)),
            ctx
        );
        
        // Transfer the TreasuryCap to the module publisher
        transfer::public_transfer(treasury_cap, sender(ctx));

        // Transfer the metadata to the module publisher
        transfer::public_freeze_object(metadata);

        transfer::transfer(AdminCap {id: object::new(ctx)}, sender(ctx));
        
        // Emit an event to log the token creation
        event::emit(TokenCreatedEvent {
            name: string::utf8(NAME),
            symbol: string::utf8(SYMBOL),
            decimals: DECIMALS,
            max_supply: MAX_SUPPLY,
        })
    }

    // Mint new tokens and transfer them to a recipient
    public entry fun mint(
        _admin: &AdminCap,
        treasury_cap: &mut TreasuryCap<MEME_TOKEN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ){
        assert!(amount > 0, EINVALID_AMOUNT);
        let total_supply = coin::total_supply(treasury_cap);
        assert!(total_supply + amount <= MAX_SUPPLY, EEXCEEDS_SUPPLY);
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);

        // Emit a custom mint event
        event::emit(MintEvent {
            amount: amount,
            recipient
        });
    }

    // Burn tokens
    public entry fun burn(
        _admin: &AdminCap,
        treasury_cap: &mut TreasuryCap<MEME_TOKEN>,
        coin: Coin<MEME_TOKEN>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&coin);
        coin::burn(treasury_cap, coin);
        
        // Emit a custom burn event
        event::emit(BurnEvent {
            amount,
            burner: sender(ctx),
        });
    }

    public entry fun transfer(
        coin: Coin<MEME_TOKEN>,
        recipient: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let from = sender(ctx);
        let total_value = coin::value(&coin);

        if (amount == total_value) {
            // Transfer the whole coin directly
            event::emit(TransferCoinEvent {
                from,
                to: recipient,
                amount,
            });
            transfer::public_transfer(coin, recipient);
        } else {
            let mut coin_input = coin;
            let recipient_coin = coin::split(&mut coin_input, amount, ctx);

            event::emit(TransferCoinEvent {
                from,
                to: recipient,
                amount: coin::value(&recipient_coin),
            });
            transfer::public_transfer(recipient_coin, recipient);

            // Remaining returned to sender (only if there's a remainder)
            event::emit(TransferCoinEvent {
                from,
                to: from,
                amount: coin::value(&coin_input),
            });
            transfer::public_transfer(coin_input, from);
        }
    }

    /// Transfer TreasuryCap ownership to another address
    public entry fun transfer_treasury_cap(
        _admin: &AdminCap,
        treasury_cap: TreasuryCap<MEME_TOKEN>,
        new_owner: address,
        ctx: &mut TxContext
    ){
        event::emit(TreasuryCapTransferred {
            previous_owner: sender(ctx),
            new_owner,
            timestamp: tx_context::epoch(ctx)   
        }); 
        transfer::public_transfer(treasury_cap, new_owner);
    }

    /// Transfer AdminCap ownership to another address
    public entry fun transfer_admin_cap(
        admin_cap: AdminCap,
        new_owner: address,
        ctx: &mut TxContext
    ){
        event::emit(AdminCapTransferred {
            previous_owner: sender(ctx),
            new_owner,
            timestamp: tx_context::epoch(ctx),
        });
        transfer::transfer(admin_cap, new_owner);
    }

    // View function to get the total supply of the token
    public fun total_supply(treasury_cap: &TreasuryCap<MEME_TOKEN>): u64 {
        coin::total_supply(treasury_cap)
    }

    // View function to get the max supply of the token
    public fun max_supply(): u64 {
        MAX_SUPPLY
    }

    // View function to get the balance of a specific address
    public fun balance_of(balance: &Balance<MEME_TOKEN>): u64 {
        balance::value(balance)
    }
}
