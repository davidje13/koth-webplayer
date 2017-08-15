define(() => {
	'use strict';

	function encodeQuery(query) {
		if(!query) {
			return '';
		}

		const q = Object.keys(query)
			.map((key) => (
				encodeURIComponent(key) +
				'=' +
				encodeURIComponent(query[key])
			))
			.join('&');

		return q ? ('?' + q) : '';
	}

	function parseAsJSON(response) {
		return response.json();
	}

	return class StackExchangeAPI {
		fetch(request, query) {
			return fetch(
				'https://api.stackexchange.com/2.2' +
				request +
				encodeQuery(query)
			);
		}

		checkError(data) {
			if(data.error_id) {
				throw (
					'StackExchange API error ' + data.error_id +
					' (' + data.error_name + '): ' +
					data.error_message
				);
			}
			return data;
		}

		requestPaginatedItems(
			request,
			query,
			filter,
			filterWithTotal,
			itemCallback,
			expectOver200 = false
		) {
			const me = this;

			const pagesize = 100;
			let loaded = 0;
			let total = 0;
			let currentPage = 1;
			const result = [];

			function handleResponse(data) {
				let baseIndex;
				if(data.page === undefined) {
					baseIndex = result.length;
				} else {
					baseIndex = (data.page - 1) * pagesize;
				}
				const maxItem = baseIndex + data.items.length;
				if(maxItem > total) {
					total = maxItem;
				}
				for(let i = 0; i < data.items.length; ++ i) {
					result[baseIndex + i] = itemCallback(
						data.items[i],
						baseIndex + i,
						loaded,
						total
					);
					++ loaded;
				}
				return data;
			}

			function loadSimultaneously(data) {
				const promises = [];
				const lastpage = Math.ceil(total / pagesize);
				for(let i = 2; i <= lastpage; ++ i) {
					promises.push(requestPage(i, filter).then(handleResponse));
				}
				promises.push(handleResponse(data));
				return Promise.all(promises);
			}

			function loadNextPage(data) {
				let more;
				if(data.has_more !== undefined) {
					more = data.has_more;
				} else {
					more = data.items.length >= pagesize;
				}
				if(more) {
					++ currentPage;
					return requestPage(currentPage, filter).then(handleResponse);
				}
				return null;
			}

			function handleFirstResponse(data) {
				if(data.total !== undefined) {
					total = data.total;
					result.length = total;
					result.fill(null);
				}

				if(data.total !== undefined && data.page !== undefined) {
					return loadSimultaneously(data);
				} else {
					return Promise.resolve(handleResponse(data)).then(loadNextPage);
				}
			}

			function requestPage(page, filter) {
				return me.fetch(
					request,
					Object.assign({pagesize, page, filter}, query)
				)
					.then(parseAsJSON)
					.then(me.checkError);
			}

			return requestPage(1, expectOver200 ? filterWithTotal : filter)
				.then(handleFirstResponse)
				.then(() => result);
		}

		requestAnswers(site, qid, answerCallback, expectOver200 = false) {
			return this.requestPaginatedItems(
				'/questions/' + qid + '/answers',
				{
					site,
					order: 'asc',
					sort: 'creation',
				},
				'!)UYbUclsid(lw1i*exlS99nouEa',
				'!GZ0YfD_RQu7cV(MmK8oC)2uBMy2(X',
				answerCallback,
				expectOver200
			);
		}
	}
});
