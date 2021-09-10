chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: parseAndSolve
    });
});

function parseAndSolve() {
    let parsedGame = parse();
    let solvedGame = solve(parsedGame);
    putResult(solvedGame, parsedGame);



    function parse() {
        let puzzles = document.querySelector("#puzzles");
        let currentPuzzle = 0;
        let size = 0;
        let result = {
            cages: []
        };
        while (puzzles.querySelector("#puzzle" + currentPuzzle) !== null) {
            let rows = Array.from(
                puzzles.querySelector("#puzzle" + currentPuzzle)
                    .querySelectorAll("tr")
            ).filter(r => r.id.startsWith("row"));
            size = rows.length;
            let table = [];
            for (let i = 0; i < size; i++) {
                table[i] = [];
                for (let j = 0; j < size; j++) {
                    table[i].push(rows[i].querySelector(`td#p${currentPuzzle}r${i}c${j}`));
                }
            }

            let cellToCage = {};
            let cages = [];

            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    if (cellToCage[`${i}_${j}`] === undefined) {
                        processItem(table, i, j, cellToCage, cages);
                    }
                }
            }


            function processItem(table, row, col, cellToCage, result) {
                const newCage = table[row][col].querySelector("span b");
                const currentCellKey = `${row}_${col}`;
                if (newCage) {
                    let operationAndExpectation = parseOperationAndExpectation(newCage.innerText);
                    cellToCage[currentCellKey] = {operation: operationAndExpectation.operation, expectation: operationAndExpectation.expectation, items: [{row: row, col: col}]};
                    result.push(cellToCage[currentCellKey]);
                }
                if (table[row][col].style["border-top"] === "" && cellToCage[(row - 1) + "_" + col] === undefined) {
                    cellToCage[currentCellKey].items.push({row: row - 1, col: col});
                    cellToCage[(row - 1) + "_" + col] = cellToCage[currentCellKey];
                    processItem(table, row - 1, col, cellToCage, result);
                }
                if (table[row][col].style["border-bottom"] === "" && cellToCage[(row + 1) + "_" + col] === undefined) {
                    cellToCage[currentCellKey].items.push({row: row + 1, col: col});
                    cellToCage[(row + 1) + "_" + col] = cellToCage[currentCellKey];
                    processItem(table, row + 1, col, cellToCage, result);
                }
                if (table[row][col].style["border-left"] === "" && cellToCage[row + "_" + (col - 1)] === undefined) {
                    cellToCage[currentCellKey].items.push({row: row , col: col - 1});
                    cellToCage[row + "_" + (col - 1)] = cellToCage[currentCellKey];
                    processItem(table, row , col - 1, cellToCage, result);
                }
                if (table[row][col].style["border-right"] === "" && cellToCage[row + "_" + (col+1)] === undefined) {
                    cellToCage[currentCellKey].items.push({row: row , col: col + 1});
                    cellToCage[row + "_" + (col + 1)] = cellToCage[currentCellKey];
                    processItem(table, row , col + 1, cellToCage, result);
                }
            }

            function parseOperationAndExpectation(value) {
                if (value.endsWith(" mod")) {
                    return {operation: "mod", expectation: parseInt(value.substring(0, value.length - " mod".length))}
                }
                let lastChar = value[value.length - 1];
                let operation = isCharNumber(lastChar) ? '+' : lastChar;
                let expectation = isCharNumber(lastChar) ? value : value.substring(0, value.length - 1);
                return {operation: operation, expectation: parseInt(expectation)};
            }

            function isCharNumber(c) {
                return c >= '0' && c <= '9';
            }

            for (let i = 0; i < cages.length; i++) {
                result.cages.push(cages[i]);
            }

            currentPuzzle++;
        }

        let minValueImgSrc = puzzles.querySelector(".new_button1 img").src;
        let splitResult = minValueImgSrc.split('/');
        let minValue = parseInt(splitResult[splitResult.length - 1].substring(0, splitResult[splitResult.length - 1].length - ".png".length));

        result.size = size;
        result.minValue = minValue;

        return result;
    }

    function solve(parsedGame) {
        const maxValue = parsedGame.minValue + parsedGame.size - 1;
        const cellToValidators = {};

        for (let i = 0; i < parsedGame.cages.length; i++) {
            let currentCage = parsedGame.cages[i];
            let operationFunc = getValidatorFunc(currentCage.operation, currentCage.expectation);
            addValidator(cellToValidators, operationFunc, currentCage.items);
        }
        for (let i = 0; i < parsedGame.size; i++) {
            let rows = [];
            for (let j = 0; j < parsedGame.size; j++) {
                rows.push({row: i, col: j});
            }
            let cols = [];
            for (let j = 0; j < parsedGame.size; j++) {
                cols.push({row: j, col: i});
            }
            addValidator(cellToValidators, (v) => !hasRepeats(v), rows);
            addValidator(cellToValidators, (v) => !hasRepeats(v), cols);
        }

        let cells = createEmptyArray(parsedGame.size);
        let result = null;
        let maxRow = -1;
        solve(cells, 0, 0);

        function solve(cells, row, col) {
            if (row > maxRow) {
                maxRow = row;
                console.log(`row ${row} reached`);
            }
            if (row >= parsedGame.size) {
                result = cells;
                return;
            }
            for (let i = parsedGame.minValue; i <= maxValue; i++) {
                if (result != null)
                    return;
                let skip = false;
                cells[row][col] = i;
                let validators = cellToValidators[`${row}_${col}`];
                for (let j = 0; j < validators.length; j++) {
                    let values = getValues(cells, validators[j].indexes);
                    if (!validators[j].func(values)) {
                        skip = true;
                        break;
                    }
                }
                if (skip)
                    continue;
                let nextCol = col + 1;
                let nextRow = row;
                if (nextCol >= parsedGame.size) {
                    nextCol = 0;
                    nextRow++;
                }
                solve(cells, nextRow, nextCol);
            }
            if (result == null)
                cells[row][col] = null;
        }

        function getValues(cells, indexes) {
            let result = [];
            for (let i = 0; i < indexes.length; i++) {
                result.push(cells[indexes[i].row][indexes[i].col]);
            }
            return result;
        }

        function createEmptyArray(size) {
            let result = [];
            for (let i = 0; i < size; i++) {
                result[i] = [];
                for (let j = 0; j < size; j++) {
                    result[i][j] = null;
                }
            }
            return result;
        }

        function addValidator(cellToValidators, func, items) {
            for (let i = 0; i < items.length; i++) {
                let currentCell = items[i];
                let currentCellKey = `${currentCell.row}_${currentCell.col}`;
                if (cellToValidators[currentCellKey] === undefined)
                    cellToValidators[currentCellKey] = [];
                cellToValidators[currentCellKey].push({indexes: items, func: func});
            }
        }

        function getValidatorFunc(operation, expectation) {
            switch (operation) {
                case "+":
                    return v => sum(v, expectation);
                case "-":
                    return v => sub(v, expectation);
                case "×":
                    return v => mul(v, expectation);
                case ":":
                    return v => div(v, expectation);
                default:
                    throw new Error(`Operation ${operation} not implemented`);
            }
        }

        function sum(values, expectation) {
            let sum = 0;
            for (let i = 0; i < values.length; i++) {
                if (values[i] === null)
                    return true;
                sum += values[i];
            }

            return sum === expectation;
        }

        function mul(values, expectation) {
            let result = null;
            for (let i = 0; i < values.length; i++) {
                if (values[i] === null)
                    return true;
                if (result === null)
                    result = values[i];
                else
                    result *= values[i];
            }
            return result === expectation;
        }

        function sub(values, expectation) {
            let max = null;
            let restSum = 0;
            for (let i = 0; i < values.length; i++) {
                if (values[i] === null)
                    return true;
                if (max === null)
                    max = values[i];
                else if (max < values[i]) {
                    restSum += max;
                    max = values[i];
                } else
                    restSum += values[i];
            }

            return max - restSum === expectation;
        }

        function div(values, expectation) {
            let max = null;
            let rest = null;
            for (let i = 0; i < values.length; i++) {
                let value = values[i];
                if (values[i] === null)
                    return true;
                if (value === 0)
                    return 0 === expectation;
                if (max === null)
                    max = value;
                else if (rest === null) {
                    if (max < value) {
                        rest = max;
                        max = value;
                    } else
                        rest = value;
                } else if (max < value) {
                    rest *= max;
                    max = value;
                } else
                    rest *= value;
            }

            return max / rest === expectation;
        }

        function hasRepeats(values) {
            const set = new Set();
            for (let i = 0; i < values.length; i++) {
                if (values[i] === null)
                    continue;
                if (set.has(values[i]))
                    return true;
                set.add(values[i])
            }

            return false;
        }

        return result;
    }

    function putResult(solvedGame, parsedGame){
        let puzzles = document.querySelector("#puzzles");
        for (let i = 0; i < parsedGame.size; i++) {
            for (let j = 0; j < parsedGame.size; j++) {
                let currentCell = puzzles.querySelector(`#p0r${i}c${j}`);
                currentCell.click();
                let index = solvedGame[i][j] - parsedGame.minValue + 1;
                puzzles.querySelector(".new_button" + index).click()
            }
        }
    }
}

