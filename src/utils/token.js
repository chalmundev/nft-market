
export const parseMedia = (media) => {
	if (!media) {
		return;
	}
	const file = '/' + media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0];
	const ipfsHash = media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0];
	if (ipfsHash) {
		return 'https://cloudflare-ipfs.com/ipfs/' + ipfsHash + file;
	}
	return media
}

export const parseToken = (token) => {
	token.metadata.media = parseMedia( token?.metadata?.media)
	return token;
};