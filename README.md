# NEAR NFT Secondary Marketplace

Goal: secondary marketplace for any NEAR NFT following standards.
https://nomicon.io/Standards/NonFungibleToken/README.html

Order Maker Flow:
1. Find NFT contract based on metadata
2. Paginate through individual tokens
3. Choose token
4. User makes offer by locking NEAR (or tokens v2?)
5. Another user can outbid this user, which will return locked funds

*cannot cancel order until some time period (24hrs) so there's no spam outbidding messing up orders*

Order Taker Flow:
1. NFT owner opens page
2. They see offer
3. Can accept offer by approving marketplace
4. (potentially) must explicitly call something like accept offer

TODO: will there be enough gas to payout all royalties if we chain nft_approve with nft_accept_offer because there will be a total of 4 calls. NFT -> Market -> NFT -> Market...

TODOs:
- [ ] sample NFT contract
- [ ] basic market contract
- [ ] basic offer in NEAR
- [ ] enumeration of offers, order maker and taker views
- [ ] nft_on_approve
