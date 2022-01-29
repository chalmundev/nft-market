

export const parseToken = (token) => {
	// swap ipfs links to cloudflare
	const media = token?.metadata?.media;  
	if (!media) {
		return;
	}

	const file = '/' + media.match(/[^/\\&\?]+\.\w{3,4}(?=([\?&].*$|$))/i)?.[0];
	const ipfsHash = media.match(/\bbafybei[a-zA-Z0-9]*\b/i)?.[0];

	if (ipfsHash) {
		token.metadata.media = 'https://cloudflare-ipfs.com/ipfs/' + ipfsHash + file;
	}

	return token;
};