// Taking individual FixedProductMarketMakers and their corresponding details.
async function createCSV(){
	// This is in seconds.
	var averageBlockTime = 15;
	var secondsInAnHour = 3600;
	var blockInterval = secondsInAnHour/averageBlockTime; // This denotes the number of blocks in an hour, currently = 240
	var dailyAverageBlockInterval = 24;

	// Subgraph Links
	var omenURL = "https://api.thegraph.com/subgraphs/name/gnosis/omen";
	var uniswapURL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2";

	// PNK Contract Address
	var pnkContractAddress = "0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d";

	// Variables
	var FPMMs;
	var uniqueTokenArray = new Set();
	var tokenToETHValue = {};
	var totalPoolLiquidityForBlock = {};
	var individualMarketValidityForBlock = {}; // This is just for validating that for that particular block, there is some value.
	var individualTotalPoolTokeninUSDValueForBlock = {};
	var ETHPriceList = {};
	var ETHPriceGQLQuery = '';
	var ETHPriceGQLData;

	// GraphQL Query & Data
	// If the number of FPMMs gets higher than 1000, then the function has to be written in a loop.
	var allFPMMGQLQuery = "{ fixedProductMarketMakers(first: 1000) { id creator collateralToken scaledLiquidityMeasure title arbitrator } }";
	var allFPMMGQLData = {
		"query": allFPMMGQLQuery,
		"variables": {}
	};
	// Creates the Query for ETH Price List from the start of the block to the end.
	for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
		ETHPriceGQLQuery += 'block'+block+': bundle(id: "1", block: {number: '+block+'}) { ethPrice } '
	}
	ETHPriceGQLQuery = '{ ' + ETHPriceGQLQuery + '}';
	ETHPriceGQLData = {
		"query": ETHPriceGQLQuery,
		"variables": {}
	};
	// This is to get the scaledLiquidityMeasure from all the FPMMs from the start of the block to the end.
	var FPMMBlockGQLQuery = '';
	var FPMMBlockGQLData;

	// CSV Content
	var CSVRowContent = [];
	var CSVContent = 'data:text/csv;charset=utf-8,';

	await fetch(omenURL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(allFPMMGQLData),
	})
	.then(response => response.json())
	.then(data => {
		FPMMs = data.data.fixedProductMarketMakers;
		console.log('Successfully queried all the FPMM Data');
		document.getElementById('previousStatus').innerHTML = 'Successfully queried all the FPMM Data';
	})
	.catch((error) => {
		console.error('Error:', error);
	})
	.then(function (){
		// Getting only unique tokens to get the token data.
		FPMMs.forEach(FPMM => {
			uniqueTokenArray.add(FPMM.collateralToken.toLowerCase());
		});
		// Adding PNK Token Also for Reward Calculation
		uniqueTokenArray.add(pnkContractAddress);
	})
	.then(async function (){
		// ETHPriceGQLData is created in details.js along with other variables used.
		// Fetching all the ethereum price from start to end block.
		await fetch(uniswapURL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(ETHPriceGQLData),
		})
		.then(response => response.json())
		.then(data => {
			for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
				let blockname = 'block'+block;
				ETHPriceList[blockname] = Number(data.data[blockname].ethPrice);
			}
			console.log('Successfully queried the ETH Price');
			document.getElementById('currentStatus').innerHTML = 'Successfully queried the ETH Price';
		})
		.catch((error) => {
			console.error('Error:', error);
		})
	})
	.then(async function (){
		// Finding the price of all the tokens in the liquidity pool from start to end block.
		let TokenGQLQuery = '';
		let TokenGQLData;
		// Creating query for getting the token details from GraphQL.
		for (let Token of uniqueTokenArray) {
			TokenGQLQuery = ''
			for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
				TokenGQLQuery += 'block'+block+': token(id: "'+Token+'", block: {number: '+block+'}){ id derivedETH } ';
			}
			TokenGQLQuery = '{ ' + TokenGQLQuery + '}';
			TokenGQLData = {
				"query": TokenGQLQuery,
				"variables": {}
			};
			await fetch(uniswapURL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(TokenGQLData),
			})
			.then(response => response.json())
			.then(data => {
				// Inserting all the ethereum price list based on the block numbers.
				for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
					let GQLID = 'block'+block;
					let tokenID = GQLID+Token;
					tokenToETHValue[tokenID] = Number(data.data[GQLID].derivedETH);
				}
				console.log('Successfully queried the '+Token+' Price');
				document.getElementById('previousStatus').innerHTML = document.getElementById('currentStatus').innerHTML;
				document.getElementById('currentStatus').innerHTML = 'Successfully queried the '+Token+' Price';
			})
			.catch((error) => {
				console.error('Error:', error);
			});
		}
	})
	.then(async function() {
		// Finally this calculates the entire amount in USD from Pool Markets from start block to end block.
		for (let block = startBlockNumber; block <= endBlockNumber; block += blockInterval) {
			FPMMBlockGQLQuery = '';
			FPMMs.forEach(FPMM => {
				let fpmmID = 'fpmm'+FPMM.id+block;
				if(FPMM.arbitrator == "0xd47f72a2d1d0e91b0ec5e5f5d02b2dc26d00a14d"
				&& FPMM.creator != "0xacbc967d956f491cadb6288878de103b4a0eb38c"
				&& FPMM.creator != "0x32981c1eeef4f5af3470069836bf95a0f8ac0508"){
					FPMMBlockGQLQuery += fpmmID+': fixedProductMarketMaker(id: "'+FPMM.id+'", block: {number: '+block+'}) { id scaledLiquidityMeasure } ';
				}
			});
			FPMMBlockGQLQuery = '{ ' + FPMMBlockGQLQuery + '}';
			FPMMBlockGQLData = {
				"query": FPMMBlockGQLQuery,
				"variables": {}
			};
	
			await fetch(omenURL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(FPMMBlockGQLData),
			})
			.then(response => response.json())
			.then(data => {
				let GQLID = 'block'+block;
				totalPoolLiquidityForBlock[GQLID] = 0;
				FPMMs.forEach(FPMM => {
					let fpmmID = 'fpmm'+FPMM.id+block;
					if(FPMM.arbitrator == "0xd47f72a2d1d0e91b0ec5e5f5d02b2dc26d00a14d"
					&& FPMM.creator != "0xacbc967d956f491cadb6288878de103b4a0eb38c"
					&& FPMM.creator != "0x32981c1eeef4f5af3470069836bf95a0f8ac0508"
					&& (data.data[fpmmID] != undefined || data.data[fpmmID] != null)){
						individualMarketValidityForBlock[fpmmID] = data.data[fpmmID].id;
						individualTotalPoolTokeninUSDValueForBlock[fpmmID] = Number(data.data[fpmmID].scaledLiquidityMeasure) * tokenToETHValue[GQLID+FPMM.collateralToken] * ETHPriceList[GQLID];
						totalPoolLiquidityForBlock[GQLID] += individualTotalPoolTokeninUSDValueForBlock[fpmmID];
					}
				});
				console.log('Successfully queried the block: '+block+' FPMM Data');
				document.getElementById('previousStatus').innerHTML = document.getElementById('currentStatus').innerHTML;
				document.getElementById('currentStatus').innerHTML = 'Successfully queried the block: '+block+' FPMM Data';
				totalPoolLiquidityForBlock[GQLID] = Math.ceil(totalPoolLiquidityForBlock[GQLID]);			
			})
			.catch((error) => {
				console.error('Error:', error);
			})
		}
	})
	.then(function() {
		// This adds the CSV Header
		let CSVHeader = ['Omen Market Link', 'Title', 'Market Creator Address'];
		for (let block = startBlockNumber; block <= endBlockNumber; block += blockInterval * dailyAverageBlockInterval) {
			CSVHeader.push('block'+block+'-'+(block+(blockInterval * dailyAverageBlockInterval)))
		}
		CSVRowContent.push(CSVHeader);
	})
	.then(function() {
		// This creates the individual average market liquidity from the start block to end block.
		FPMMs.forEach(FPMM => {
			let FPMMID = FPMM.id;
			let FPMMIDLink = '=HYPERLINK("https://omen.eth.link/#/'+FPMMID+'")';
			let CSVRow = ['"'+FPMMIDLink+'"', '"'+FPMM.title+'"', FPMM.creator];
			let totalValueAmongRow = 0;
			for (let block = startBlockNumber; block <= endBlockNumber; block += blockInterval * dailyAverageBlockInterval) {
				let averageIndividualTotalPoolTokenInUSDValueForDailyAverageBlockInterval = 0;
				let dividedBy = 0;
				for (let blockBy24 = block; blockBy24 < block + (blockInterval * dailyAverageBlockInterval) && blockBy24 <= endBlockNumber; blockBy24 += blockInterval) {
					let fpmmID = 'fpmm'+FPMM.id+blockBy24;
					if(FPMM.arbitrator == "0xd47f72a2d1d0e91b0ec5e5f5d02b2dc26d00a14d"
					&& FPMM.creator != "0xacbc967d956f491cadb6288878de103b4a0eb38c"
					&& FPMM.creator != "0x32981c1eeef4f5af3470069836bf95a0f8ac0508"
					&& individualMarketValidityForBlock[fpmmID] == FPMM.id){
						averageIndividualTotalPoolTokenInUSDValueForDailyAverageBlockInterval += individualTotalPoolTokeninUSDValueForBlock[fpmmID];
						dividedBy += 1;
					}
				}
				let finalValue = averageIndividualTotalPoolTokenInUSDValueForDailyAverageBlockInterval/dividedBy;
				if(isNaN(finalValue)){
					finalValue = 0;
				}
				CSVRow.push(finalValue);
				totalValueAmongRow += finalValue;
			}
			// If there are no values among the columns in a row, we don't add it to the final list.
			if(totalValueAmongRow != 0){
				CSVRowContent.push(CSVRow);
			}
		});
	})
	.then(function() {
		CSVRowContent.forEach(function(rowArray) {
			let row = rowArray.join(',');
			CSVContent += row + '\r\n';
		});
	
		var encodedUri = encodeURI(CSVContent);
		encodedUri = encodedUri.replace(/#/g, '%23');
		var link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", "FPMMArchiveData.csv");
		document.body.appendChild(link);
	
		link.click();
	})
	.then(function() {
		document.getElementById('previousStatus').innerHTML = 'Done!';
		document.getElementById('currentStatus').innerHTML = '';
	});
}
