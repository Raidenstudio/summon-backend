module meme_launchpad::safe_math {

    public fun checked_mul(a: u64, b: u64): Option<u64> {
        if (a == 0 || b == 0) return option::some(0);
        let result = a * b;
        if (result / a != b) option::none() else option::some(result)
    }

    public fun checked_sub(a: u64, b: u64): Option<u64> {
        if (a < b) option::none() else option::some(a - b)
    }

    public fun checked_div(a: u64, b: u64): Option<u64> {
        if (b == 0) option::none() else option::some(a / b)
    }

    public fun checked_add(a: u64, b: u64): Option<u64> {
        let result = a + b;
        if (result < a || result < b) option::none() else option::some(result)
    }
}