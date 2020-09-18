var demo;

// Infura API Link
var mainnetInfuraAPILink = "https://mainnet.infura.io/v3/2ed091fa3e0143c496fb5837c3a83704";

window.addEventListener('load', function () {
    console.log('For Web3 using HTTP Provider');
    web3 = new Web3(new Web3.providers.HttpProvider(mainnetInfuraAPILink));
})

// Start Block and End Block Time
var startBlockNumber; // These will be asked in front end.
var endBlockNumber; // These will be asked in front end.

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
var FPMMs; // Will contain all the FPMM with its detail created till now.
var uniqueTokenArray = new Set(); // Will contain all the token address used in FPMM as Liquidity Token.
var tokenToETHValue = {}; // Will contain the token price in terms of ETH.
var totalPoolLiquidityForBlock = {}; // This contains the total pool liquidity for a particular block.
var individualMarketValidityForBlock = {}; // This is just for validating that for that particular block, there is some value.
var individualTotalPoolTokeninUSDValueForBlock = {}; // This stores the individual market pool liquidity in USD for a particular block.
var ETHPriceList = {}; // This contains the price list of ETH of block from the start block to the end block mentioned.
var ETHPriceGQLQuery = ''; // This will contain the query used in TheGraph for querying the ETH price data.
var ETHPriceGQLData;
var uniqueProxyCreator = new Set(); // Will contain all the unique proxy contracts.
var marketCreator = {}; // This will store the actual creator of the market, from the proxy.
var marketCreatorReward = {}; // This will contain the amount of reward in PNK for a particular market creator address.
var marketCreatorRewardAddress = new Set(); // This contains the list of unique market creator address for the block period mentioned.
var averageLiquidityOfMarket = {}; // This contains the average liquidity of a market based on hourly snapshots for the block period.
var totalAverageLiquidityOfMarket = 0; // This contains the total average liquidity of a market for the block period.
var monthlyPNKReward = 300000; // This is the monthly PNK Reward.

// GraphQL Query & Data
// If the number of FPMMs gets higher than 1000, then the function has to be written in a loop.
var allFPMMGQLQuery = "{ fixedProductMarketMakers(first: 1000) { id creator collateralToken scaledLiquidityMeasure title arbitrator klerosTCRitemID klerosTCRstatus } }";
var allFPMMGQLData = {
    "query": allFPMMGQLQuery,
    "variables": {}
};
// This is to get the scaledLiquidityMeasure from all the FPMMs from the start of the block to the end.
var FPMMBlockGQLQuery = '';
var FPMMBlockGQLData;

// This is to get the actual user behind the proxy.
var ABI = '[{ "constant": true, "inputs": [], "name": "getOwners", "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }], "payable": false, "stateMutability": "view", "type": "function" }]';

// CSV Content
var CSVRowContentDetailed = [];
var CSVContentDetailed = 'data:text/csv;charset=utf-8,';
var CSVRowContentBasic = [];
var CSVContentBasic = 'data:text/csv;charset=utf-8,';
var CSVRowContentReward = [];
var CSVContentReward = 'data:text/csv;charset=utf-8,';

function initiateFN() {
    // Change these values according to use.
    startBlockNumber = Number(document.getElementById('start-Block').value);
    endBlockNumber = Number(document.getElementById('end-Block').value);

    // Calling the main function to calculate the data to CSV.
    createCSV();
}

function updateStatus(newStatus, completed) {
    console.log(newStatus);
    if(completed){
        document.getElementById('previousStatus').innerHTML = '';
    }
    else{
        document.getElementById('previousStatus').innerHTML = document.getElementById('currentStatus').innerHTML;
    }
    document.getElementById('currentStatus').innerHTML = newStatus;    
}