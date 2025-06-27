module meme_launchpad::safe_math_u256 {

    public fun checked_mul(a: u256, b: u256): Option<u256> {
        if (a == 0 || b == 0) return option::some(0);
        let result = a * b;
        if (b != 0 && result / b != a) option::none() else option::some(result)
    }

    public fun checked_div(a: u256, b: u256): Option<u256> {
        if (b == 0) option::none() else option::some(a / b)
    }

    public fun checked_add(a: u256, b: u256): Option<u256> {
        let result = a + b;
        if (result < a || result < b) option::none() else option::some(result)
    }
}