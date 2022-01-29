

export const parseToken = (token) => {
	// invalid tokens
	if (!token?.metadata?.media) {
		return;
	}
	// swap ipfs links to cloudflare
	const media = token.metadata.media;  

	const file = '/' + token.metadata.media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0];
	const ipfsHash = token.metadata.media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0];

	if (ipfsHash) {
		token.metadata.media = 'https://cloudflare-ipfs.com/ipfs/' + ipfsHash + file;
	}

	return token;
};