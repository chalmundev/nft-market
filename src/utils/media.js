
export const parseData = (contractMap, batch, data, item, noLabel) => {
	const { label, format, innerKey, isToken } = data
	const { contract_id, token_id } = item
	let { name: title, media } = contractMap[contract_id] || {}
	let subtitle = noLabel ? '' : label + ' '
	subtitle += (format ? format(item[innerKey]) : item[innerKey])
	let link = `/contract/${contract_id}`

	if (isToken) {
		const token = batch[contract_id]?.[token_id]
		title = token_id
		media = token?.metadata?.media
		link = `/token/${contract_id}/${token_id}`
	}

	return { title, subtitle, media, link }
}

export const parseMedia = (media) => {
	if (!media) {
		return;
	}
	const file = '/' + media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0];
	const ipfsHash = media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0];
	if (ipfsHash) {
		return 'https://cloudflare-ipfs.com/ipfs/' + ipfsHash + file;
	}
	return media;
};

export const parseToken = (token) => {
	token.metadata.media = parseMedia( token?.metadata?.media);
	return token;
};