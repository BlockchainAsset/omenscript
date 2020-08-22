var startBlockNumber;
var endBlockNumber;

function initiateFN() {
    // Change these values according to use.
    startBlockNumber = Number(document.getElementById('start-Block').value);
    endBlockNumber = Number(document.getElementById('end-Block').value);

    // Calling the main function to calculate the data to CSV.
    createCSV();
}