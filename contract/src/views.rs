use crate::*;

#[near_bindgen]
impl Contract {

	pub fn get_market_balance(&self) -> U128 {
        U128(self.market_balance)
    }

	pub fn get_market_royalty(&self) -> u32 {
        self.market_royalty
    }
}
