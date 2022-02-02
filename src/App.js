import React, { useContext, useEffect, useState } from 'react';
import {
	Routes,
	Route,
	Link,
	useNavigate,
} from "react-router-dom";

import { appStore, fetchContracts, fetchData } from './state/app';
import { initNear } from './state/near';
import { networkId } from './../utils/near-utils';

import { Nav } from './components/Nav';
import { RouteOffers } from './components/RouteOffers';
import { RouteContract } from './components/RouteContract';
import { RouteToken } from './components/RouteToken';
import { RouteContracts } from './components/RouteContracts';
import { RouteMain } from './components/RouteMain';

import './App.scss';

const App = ({ mobile }) => {

	const { state, dispatch, update } = useContext(appStore);

	const navigate = useNavigate();

	const onMount = async () => {
		await Promise.all([
			dispatch(initNear()),
			dispatch(fetchData()),
			dispatch(fetchContracts()),
		]);
		update('loading', false);
	};
	useEffect(onMount, []);

	const {
		wallet, account, data,
		data: {
			marketSummary, contracts, 
			index, cache,
			offers, supply,
		}
	} = state;

	const showBackHome = /\/(maker|taker)/gi.test(window.location.pathname);
	const showBackToken = /\/(token)/gi.test(window.location.pathname);
	const showBackContact = /\/(contract)/gi.test(window.location.pathname);

	return (
		<main className="container-fluid">

			<Nav {...{ wallet, mobile }} />

			<section className="content">
				{
					state.loading
						?
						<>
							<div className='crumbs'><p aria-busy="true">Loading</p></div>
						</>
						:
						<>
							<div className='crumbs'>
								{showBackHome || showBackToken || showBackContact ? <div><Link to="/" onClick={(e) => {
									e.preventDefault();
									if (showBackToken) {
										return navigate(window.location.pathname.split('/').slice(0, -1).join('/').replace('/token', '/contract'));
									}
									if (showBackContact) {
										update('data.index', 0);
									}
									navigate('/');
								}}>Back</Link></div> : <div></div>}
								{account && <div><a href={`https://explorer.${networkId}.near.org/accounts/${account.accountId}`} target="_blank">{account.accountId}</a></div>}
							</div>

							<Routes>
								<Route path="/offers/maker" element={
									<RouteOffers {...{ dispatch, update, account, offers, index, supply, cache }} />
								} />

								<Route path="/offers/taker" element={
									<RouteOffers {...{ dispatch, update, account, offers, index, supply, cache }} />
								} />

								<Route path="/contract/:contract_id" element={
									<RouteContract {...{ dispatch, update, account, data }} />
								} />

								<Route path="/token/:contract_id/:token_id" element={
									<RouteToken {...{ dispatch, update, account, data }} />
								} />

								<Route path="/contracts" element={
									<RouteContracts {...{ update, index, contracts }} />
								} />

								<Route path="/" element={
									<RouteMain {...{ update, marketSummary }} />
								} />
							</Routes>
						</>
				}
			</section>
		</main>
	);
};

export default App;
