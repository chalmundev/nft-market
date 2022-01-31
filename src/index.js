import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AppProvider } from './state/app.js';
import { BrowserRouter } from 'react-router-dom';
import mobile from 'is-mobile';

ReactDOM.render(
	<AppProvider>
		<BrowserRouter>
			<App { ...{
				mobile: mobile()
			} } />
		</BrowserRouter>
	</AppProvider>,
	document.getElementById('root')
);
