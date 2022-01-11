use crate::*;

#[near_bindgen]
impl Contract {

	pub fn get_market_holdings(&self) -> U128 {
        U128(self.market_holdings)
    }

	pub fn get_market_royalty(&self) -> u32 {
        self.market_royalty
    }
}
