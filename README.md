# omenscript
A simple interface for calculating the Omen Liquidity Pool Reward for the Marketing Campaign.

# Steps
1. Clone the repo.
2. Go to `js/details.js` and in Line 4 add your infura mainnet API Link (or any other Mainnet HTTPProvider).
3. Open index.html on any browser.
4. Insert the start and end block number which you want to generate.
5. It will take some time, you can see the updates in the console or in the browser itself.
6. It will ask to allow downloading multiple sheets. Please allow it to download 2 more files (Total 3 files will be downloaded).
7. If you want to upload that data into Google Sheets, please create a new sheet. Then import the csv one by one, make sure to name the sheets same as the download file name, `Detailed`, `Basic` and `Reward`, as it references data from different sheets.