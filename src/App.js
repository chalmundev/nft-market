import React, { useContext, useEffect } from 'react';
import {
	Routes,
	Route,
	Link,
	useNavigate,
} from "react-router-dom";

import { appStore, onAppMount, fetchContracts, fetchData } from './state/app';
import { initNear } from './state/near';
import { useStore } from './utils/store';

import { Modal } from './components/Modal';
import { Loading } from './components/Loading';
import { Nav } from './components/Nav';
import { RouteOffers } from './components/RouteOffers';
import { RouteContract } from './components/RouteContract';
import { RouteToken } from './components/RouteToken';
import { RouteContracts } from './components/RouteContracts';
import { RouteSummary } from './components/RouteSummary';
import { RouteMain } from './components/RouteMain';

import './css/App.scss';

let resizeTimeout

const App = ({ mobile }) => {

	const { state, dispatch, update } = useContext(appStore);
	const [about, setAbout] = useStore('__ABOUT_MODAL')
	const navigate = useNavigate();

	const { href, pathname } = window.location;
	const showAbout = /\/(token|contract)/gi.test(pathname);
	const showBack = /\/(maker|taker|summary|contract)/gi.test(pathname);
	const showBackToken = /\/(token)/gi.test(pathname);
	const txHashes = href.split('?transactionHashes=')[1];

	window.scrollTo(0, 0)

	const onMount = async () => {
		await dispatch(onAppMount({ mobile })),
		await dispatch(fetchContracts()),
		await Promise.all([
			dispatch(initNear()),
			dispatch(fetchData()),
		]);
		update('loading', false);

		if (showAbout) {
			if (!about) {
				setAbout(2)
			} else {
				setAbout(about - 1)
			}
			if (!about || about > 0) {
				alert(<>
					<p>Place offers on any NEAR NFT, any time!</p>
					<p>NFT owners can set prices and share links to find buyers.</p>
					<button className="alert" onClick={() => setAbout(0)}>Don't Show Again</button>
				</>)
			}
		}

		if (mobile) return

		/// resets components after debounce onresize (desktop only)

		window.onresize = () => {
			update('loading', true)
			if (resizeTimeout) clearTimeout(resizeTimeout)
			resizeTimeout = setTimeout(() => update('loading', false), 500)
		}
	};
	useEffect(onMount, []);

	const {
		networkId,
		wallet, account, data, modal,
		pageSize,
		data: {
			marketSummary, contracts, contractMap,
			index, batch,
			offers, supply,
		}
	} = state;

	const routeParams = { dispatch, update, navigate, mobile, networkId, pageSize };

	return (<>

		{ modal && <Modal {...{ ...modal, update } } />}

		<main className="container-fluid">

			<Nav {...{ networkId, wallet, mobile }} />

			<section className={['content', mobile && 'mobile'].join(' ')}>
				{
					state.loading
						?
						<Loading />
						:
						<>
							<div className='crumbs'>
								{showBack || showBackToken ? <div><Link to="/" onClick={(e) => {
									e.preventDefault();
									update('data.index', 0);
									if (showBackToken && txHashes) {
										return navigate('/');
										// return navigate(pathname.split('/').slice(0, -1).join('/').replace('/token', '/contract'));
									}
									return navigate(-1);
								}}>Back</Link></div> : <div></div>}
								{account && <div><a href={`https://wallet.${networkId}.near.org/profile/${account.accountId}`} target="_blank">{account.accountId}</a></div>}
							</div>

							<Routes>
								<Route path="/offers/maker" element={
									<RouteOffers {...{ ...routeParams, account, data }} />
								} />

								<Route path="/offers/taker" element={
									<RouteOffers {...{ ...routeParams, account, data }} />
								} />

								<Route path="/contract/:contract_id" element={
									<RouteContract {...{ ...routeParams, account, data }} />
								} />

								<Route path="/contract/:contract_id/:account_id" element={
									<RouteContract {...{ ...routeParams, account, data }} />
								} />

								<Route path="/token/:contract_id/:token_id" element={
									<RouteToken {...{ ...routeParams, account, data }} />
								} />

								<Route path="/contracts" element={
									<RouteContracts {...{ ...routeParams, index, contracts }} />
								} />

								<Route path="/summary/:key" element={
									<RouteSummary {...{ ...routeParams, batch, marketSummary, contractMap, index }} />
								} />

								<Route path="/" element={
									<RouteMain {...{ ...routeParams, batch, marketSummary, contractMap, index }} />
								} />
							</Routes>
						</>
				}
			</section>
		</main>
	</>
	);
};

export default App;
