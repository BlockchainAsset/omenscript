var startBlockNumber;
var endBlockNumber;

function initiateFN() {
    // Change these values according to use.
    startBlockNumber = Number(document.getElementById('start-Block').value); //10670000
    endBlockNumber = Number(document.getElementById('end-Block').value); // 10690000

    // Calling the main function to calculate the data to CSV.
    createCSV();
}