use std::fmt;

use near_sdk::{serde::{Deserialize, Serialize}, AccountId, json_types::U128};
use near_sdk::serde_json;
/// Enum that represents the data type of the EventLog.
/// The enum can either be an UpdateOffer or a ResolveOffer.
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "snake_case")]
#[serde(crate = "near_sdk::serde")]
#[non_exhaustive]
pub enum EventLogVariant {
    UpdateOffer(OfferLog),
    ResolveOffer(OfferLog),
}

/// Interface to capture data about an event
///
/// Arguments:
/// * `event`: associate event data
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct EventLog {
    // `flatten` to not have "event": {<EventLogVariant>} in the JSON, just have the contents of {<EventLogVariant>}.
    #[serde(flatten)]
    pub event: EventLogVariant,
}

impl fmt::Display for EventLog {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_fmt(format_args!(
            "MARKET_EVENT:{}",
            &serde_json::to_string(self).map_err(|_| fmt::Error)?
        ))
    }
}

/// An event log to capture when an offer is updated
/// contract_id, token_id, maker_id, taker_id, amount, updated_at
#[derive(Serialize, Deserialize, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct OfferLog {
    pub contract_id: AccountId,
    pub token_id: String,
    pub maker_id: AccountId,
    pub taker_id: AccountId,
    pub amount: U128,
    pub updated_at: u64,
}