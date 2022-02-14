
export const parseData = (contractMap, batch, data, item, noLabel) => {
	const { label, format, innerKey, isToken } = data;
	const { contract_id, token_id } = item;
	let { name: title, media } = contractMap[contract_id] || {};
	const subtitleContent = format ? format(item[innerKey]) : item[innerKey];
	const subtitle = noLabel ? subtitleContent : <span>{label} {subtitleContent}</span>;
	let link = `/contract/${contract_id}`;
	let owner_id = item?.owner_id;
	if (isToken) {
		const token = batch[contract_id]?.[token_id];
		title = token_id;
		media = token?.metadata?.media;
		link = `/token/${contract_id}/${token_id}`;
		if (!owner_id) owner_id = token?.owner_id;
	}
	return { title, subtitle, media, link, owner_id };
};

const CLOUDFLARE = 'https://cloudflare-ipfs.com/ipfs/'
const IPFS = 'https://ipfs.io/ipfs/'

export const parseMedia = (media) => {
	if (!media) {
		return;
	}
	const file = media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0];
	const ipfsHash = media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0];
	if (ipfsHash) {
		return IPFS + ipfsHash + (file ? '/' + file : '');
	}
	if (!/http|https/.test(media)) return undefined
	return media;
};

export const parseToken = (token) => {
	token.metadata.media = parseMedia(token?.metadata?.media);
	return token;
};