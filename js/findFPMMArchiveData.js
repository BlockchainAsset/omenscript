// Taking individual FixedProductMarketMakers and their corresponding details.
async function createCSV(){
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
		updateStatus('Successfully queried all the FPMM Data', false);
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
		// Creates the Query for ETH Price List from the start of the block to the end.
		for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
			ETHPriceGQLQuery += 'block'+block+': bundle(id: "1", block: {number: '+block+'}) { ethPrice } '
		}
		ETHPriceGQLQuery = '{ ' + ETHPriceGQLQuery + '}';
		ETHPriceGQLData = {
			"query": ETHPriceGQLQuery,
			"variables": {}
		};

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
				// We are using the blockXYZ format for storing the ETH Price at a block XYZ.
				let blockname = 'block'+block;
				ETHPriceList[blockname] = Number(data.data[blockname].ethPrice);
			}
			updateStatus('Successfully queried the ETH Price', false);
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
				TokenGQLQuery += 'block'+block+': token(id: "'+Token+'", block: {number: '+block+'}){ id name derivedETH } ';
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
				let GQLID = '';
				for (let block = startBlockNumber; block <= endBlockNumber; block+=blockInterval) {
					GQLID = 'block'+block;
					let tokenID = GQLID+Token;
					tokenToETHValue[tokenID] = Number(data.data[GQLID].derivedETH);
				}
				updateStatus('Successfully queried the '+data.data[GQLID].name+' Price', false)
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
				updateStatus('Successfully queried the block: '+block+' FPMM Data', false);
				totalPoolLiquidityForBlock[GQLID] = Math.ceil(totalPoolLiquidityForBlock[GQLID]);			
			})
			.catch((error) => {
				console.error('Error:', error);
			})
		}
	})
	.then(async function() {
		// This gets the actual market creator who created the market. The user wallet.
		// The FPMM.creator is actually a proxy.

		// Creating the list of only unique proxy contracts.
		FPMMs.forEach(FPMM => {
			uniqueProxyCreator.add(FPMM.creator);
		})

		for(let proxy of uniqueProxyCreator){
			var proxyContract = new web3.eth.Contract(JSON.parse(ABI), proxy);
			await proxyContract.methods.getOwners().call(function(error, result){
				demo = result
			})
			.then(function() {
				marketCreator[proxy] = demo[0];
				updateStatus('Successfully queried the user from the proxy: '+proxy, false);
			});
		}

	})
	.then(function() {
		// This adds the CSV Headers to Detailed, Basic and Reward CSVs.

		// For Detailed One.
		let CSVHeader = ['Omen Market Link', 'Title', 'Market Creator Proxy', 'Market Creator'];
		for (let block = startBlockNumber; block <= endBlockNumber; block += blockInterval * dailyAverageBlockInterval) {
			CSVHeader.push('block'+block+'-'+(block+(blockInterval * dailyAverageBlockInterval)))
		}
		CSVHeader.push('Average Liquidity over the period '+startBlockNumber+' to '+endBlockNumber);
		CSVRowContentDetailed.push(CSVHeader);

		// For Basic One.
		CSVHeader = ['Omen Market Link', 'Title', 'Market Creator Proxy', 'Market Creator', 'Average Liquidity', 'PNK Reward', 'VALID/INVALID', 'Liquidity Based on Validity', 'PNK Reward Based on Validity'];
		CSVRowContentBasic.push(CSVHeader);

		// For Reward One.
		CSVHeader = ['Market Creator', 'Total PNK Reward Based On Validity'];
		CSVRowContentReward.push(CSVHeader);

	})
	.then(function() {
		// This creates the individual average market liquidity from the start block to end block.
		FPMMs.forEach(FPMM => {
			// let FPMMIDLink = '=HYPERLINK("https://omen.eth.link/#/'+FPMM.id+'")'; // This does not work for Google Sheets
			let FPMMIDLink = 'https://omen.eth.link/#/'+FPMM.id+''; // This works for Google Sheets
			let CSVRow = [FPMMIDLink, '"'+FPMM.title+'"', FPMM.creator, marketCreator[FPMM.creator]];
			let totalValueAmongRow = 0;
			let totalValueAmongRowDividedBy = 0;
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
				totalValueAmongRowDividedBy += 1;
			}
			// If there are no values among the columns in a row, we don't add it to the final list.
			if(totalValueAmongRow != 0){
				averageLiquidityOfMarket[FPMM.id] = totalValueAmongRow/totalValueAmongRowDividedBy;
				totalAverageLiquidityOfMarket += averageLiquidityOfMarket[FPMM.id];
				CSVRow.push(averageLiquidityOfMarket[FPMM.id]);
				CSVRowContentDetailed.push(CSVRow);
			}
		});
	})
	.then(function() {
		// This is to find how many columns will be there.
		let totalIndex = 2;
		FPMMs.forEach(FPMM => {
			if(averageLiquidityOfMarket[FPMM.id] > 0){
				totalIndex++;
			}
		})
		// This populates the ROW data for Basic CSV
		let index = 2;
		FPMMs.forEach(FPMM => {
			let FPMMIDLink = 'https://omen.eth.link/#/'+FPMM.id+'';
			// let FPMMTCRLink = '';
			// if(FPMM.klerosTCRstatus == 1){
			// 	FPMMTCRLink = 'https://curate.kleros.io/tcr/0xb72103eE8819F2480c25d306eEAb7c3382fBA612/'+FPMM.klerosTCRitemID;
			// }
			if(averageLiquidityOfMarket[FPMM.id] > 0){
				let PNKReward = monthlyPNKReward * (averageLiquidityOfMarket[FPMM.id]/totalAverageLiquidityOfMarket);
				if(marketCreatorReward[FPMM.creator] == undefined){
					marketCreatorReward[FPMM.creator] = 0;
				}
				marketCreatorReward[FPMM.creator] += PNKReward;
				marketCreatorRewardAddress.add(marketCreator[FPMM.creator]);
				// https://stackoverflow.com/a/22144225/7520013
				let averageLiquidityCol = `"=IF(G${index}=""VALID"", E${index}, 0)"`;
				let PNKRewardCol = '=(H'+index+'/H$'+totalIndex+')*'+monthlyPNKReward;
				let CSVRow = [FPMMIDLink, '"'+FPMM.title+'"', FPMM.creator, marketCreator[FPMM.creator], averageLiquidityOfMarket[FPMM.id], PNKReward, 'VALID', averageLiquidityCol, PNKRewardCol];
				index++;
				CSVRowContentBasic.push(CSVRow);
			}
		})
		totalIndex--;
		let CSVRow = [,,,,,,'Total Liquidity Based on Validity', '=SUM(H2:H'+totalIndex+')', '=sum(I2:I'+totalIndex+')'];
		CSVRowContentBasic.push(CSVRow);

		index = 2;
		// This populates the ROW data for Reward CSV
		for (let creator of marketCreatorRewardAddress) {
			let CSVRow = [creator, `"=SUMIF(Basic!D$${index}:D$${totalIndex}, A${index}, Basic!I$${index}:I$${totalIndex})"`];
			index++;
			CSVRowContentReward.push(CSVRow);
		}
	})
	.then(function() {
		// This is the download CSV section.
		// This one created the row content for the Detailed.
		CSVRowContentDetailed.forEach(function(rowArray) {
			let row = rowArray.join(',');
			CSVContentDetailed += row + '\r\n';
		});
	
		// This one created the row content for the Basic.
		CSVRowContentBasic.forEach(function(rowArray) {
			let row = rowArray.join(',');
			CSVContentBasic += row + '\r\n';
		});
	
		// This one created the row content for the Reward.
		CSVRowContentReward.forEach(function(rowArray) {
			let row = rowArray.join(',');
			CSVContentReward += row + '\r\n';
		});

		// This one downloads the detailed version.
		var encodedUri = encodeURI(CSVContentDetailed);
		encodedUri = encodedUri.replace(/#/g, '%23');
		var link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", "Detailed.csv");
		document.body.appendChild(link);
		link.click();

		// This one downloads the basic version.
		encodedUri = encodeURI(CSVContentBasic);
		encodedUri = encodedUri.replace(/#/g, '%23');
		link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", "Basic.csv");
		document.body.appendChild(link);
		link.click();

		// This one downloads the reward version.
		encodedUri = encodeURI(CSVContentReward);
		link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", "Reward.csv");
		document.body.appendChild(link);
		link.click();
	})
	.then(function() {
		updateStatus('Done!', true);
	});
}
