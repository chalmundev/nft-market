

import copy from 'copy-to-clipboard';

const HELPER_URL = 'https://nearapi.secondx.app/';
const SHARE_URL = HELPER_URL + 'v1/share/';

const defaultTitle = 'NFTs on SecondX.app'
const defaultDescription = 'Click to bid on this NFT!'
export const shareToken = async (contract_id, token_id, link, title) => {
	const url = await getShareUrl({
		contract_id,
		token_id,
		link,
		title,
	})

	if (window.navigator.share) {
		await window.navigator.share({
			title: defaultTitle,
			text: defaultDescription,
			url,
		});
	} else {
		copy(url)
		alert('Link Copied!')
	}
}

const getShareUrl = async ({
	contract_id,
	token_id,
	link,
	title = defaultTitle,
	description = defaultDescription,
}) => {
	return (await fetch(SHARE_URL + JSON.stringify({
		title,
		description,
		nft: { contract_id, token_id },
		redirect: encodeURIComponent(window.origin + link)
	})).then((res) => res.json())).encodedUrl;
};