// Pattern checker for bingo game
export function checkWinningPattern(
  card,
  calledNumbers,
  pattern = "1line",
  currentNumber
) {
  const columns = ["B", "I", "N", "G", "O"];
  const size = 5;

  // Helper function to check if a number is called
  const isCalled = (num) => calledNumbers.includes(num);

  // Helper function to get number at position
  const getNumberAt = (row, col) => {
    const column = columns[col];
    return card[column][row];
  };

  // Helper function to check if a cell is marked (called or free space)
  const isMarked = (row, col) => {
    if (row === 2 && col === 2) return true; // Always free
    const num = getNumberAt(row, col);
    if (num === 0 || num === null || String(num) === "FREE") return true;
    return isCalled(num);
  };

  // Check rows
  const winningRows = [];
  for (let row = 0; row < size; row++) {
    let rowWin = true;
    const rowCells = [];

    for (let col = 0; col < size; col++) {
      if (!isMarked(row, col)) {
        rowWin = false;
        break;
      }
      rowCells.push({ row, col });
    }

    if (rowWin) {
      winningRows.push(rowCells);
    }
  }

  // Check columns
  const winningColumns = [];
  for (let col = 0; col < size; col++) {
    let colWin = true;
    const colCells = [];

    for (let row = 0; row < size; row++) {
      if (!isMarked(row, col)) {
        colWin = false;
        break;
      }
      colCells.push({ row, col });
    }

    if (colWin) {
      winningColumns.push(colCells);
    }
  }

  // Check diagonals
  const winningDiagonals = [];

  // Diagonal 1: Top-left to bottom-right
  let diag1Win = true;
  const diag1Cells = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, i)) {
      diag1Win = false;
      break;
    }
    diag1Cells.push({ row: i, col: i });
  }
  if (diag1Win) {
    winningDiagonals.push(diag1Cells);
  }

  // Diagonal 2: Top-right to bottom-left
  let diag2Win = true;
  const diag2Cells = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, size - 1 - i)) {
      diag2Win = false;
      break;
    }
    diag2Cells.push({ row: i, col: size - 1 - i });
  }
  if (diag2Win) {
    winningDiagonals.push(diag2Cells);
  }

  // Check X pattern (both diagonals)
  const xPatternCells = [];
  if (diag1Win && diag2Win) {
    xPatternCells.push(...diag1Cells, ...diag2Cells);
  }

  // Check outer square pattern (4 corners only)
  const outerSquareCells = [];
  let outerSquareWin = true;

  const corners = [
    { row: 0, col: 0 }, // Top-left
    { row: 0, col: 4 }, // Top-right
    { row: 4, col: 0 }, // Bottom-left
    { row: 4, col: 4 }, // Bottom-right
  ];

  for (const corner of corners) {
    if (!isMarked(corner.row, corner.col)) {
      outerSquareWin = false;
      break;
    }
    outerSquareCells.push(corner);
  }

  // Check inner square pattern (4 corners of 3x3 center area only)
  const innerSquareCells = [];
  let innerSquareWin = true;

  const innerCorners = [
    { row: 1, col: 1 }, // Top-left of inner area
    { row: 1, col: 3 }, // Top-right of inner area
    { row: 3, col: 1 }, // Bottom-left of inner area
    { row: 3, col: 3 }, // Bottom-right of inner area
  ];

  for (const corner of innerCorners) {
    if (!isMarked(corner.row, corner.col)) {
      innerSquareWin = false;
      break;
    }
    innerSquareCells.push(corner);
  }

  // Helper function to check if current number is part of winning pattern
  const checkCurrentNumberInPattern = (winningCells) => {
    if (!currentNumber) return "win";

    const hasCurrentNumberInPattern = winningCells.some(({ row, col }) => {
      const num = card[columns[col]][row];
      return num === currentNumber;
    });

    if (!hasCurrentNumberInPattern) {
      console.log(
        `🔍 "not_now" detected: currentNumber=${currentNumber}, winningCells=${winningCells.length} cells`
      );
    }

    return hasCurrentNumberInPattern ? "win" : "not_now";
  };

  // Check specific patterns
  switch (pattern) {
    case "1line": {
      let completedPatterns = 0;
      let winningCells = [];

      if (winningRows.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningRows.flat());
      }
      if (winningColumns.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningColumns.flat());
      }
      if (winningDiagonals.length >= 1) {
        completedPatterns++;
        winningCells.push(...winningDiagonals.flat());
      }
      if (innerSquareWin) {
        completedPatterns++;
        winningCells.push(...innerSquareCells);
      }
      if (outerSquareWin) {
        completedPatterns++;
        winningCells.push(...outerSquareCells);
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        winningCells.push(...xPatternCells);
      }

      // Remove duplicates
      const uniqueWinningCells = winningCells.filter(
        (cell, index, self) =>
          index ===
          self.findIndex((c) => c.row === cell.row && c.col === cell.col)
      );

      const isWinner = completedPatterns >= 1;
      const status = isWinner
        ? checkCurrentNumberInPattern(uniqueWinningCells)
        : "lose";
      return { isWinner, winningCells: uniqueWinningCells, status };
    }
    case "2line": {
      let completedPatterns = 0;
      let patternCells = [];

      completedPatterns += winningRows.length;
      patternCells.push(...winningRows);

      completedPatterns += winningColumns.length;
      patternCells.push(...winningColumns);

      completedPatterns += winningDiagonals.length;
      patternCells.push(...winningDiagonals);

      if (innerSquareWin) {
        completedPatterns++;
        patternCells.push(innerSquareCells);
      }
      if (outerSquareWin) {
        completedPatterns++;
        patternCells.push(outerSquareCells);
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        patternCells.push(xPatternCells);
      }

      const isWinner = completedPatterns >= 2;

      if (isWinner) {
        const winningCells = patternCells.flat();

        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];

        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      } else {
        return { isWinner: false, winningCells: [], status: "lose" };
      }
    }
    case "3line": {
      let completedPatterns = 0;
      let patternCells = [];

      completedPatterns += winningRows.length;
      patternCells.push(...winningRows);

      completedPatterns += winningColumns.length;
      patternCells.push(...winningColumns);

      completedPatterns += winningDiagonals.length;
      patternCells.push(...winningDiagonals);

      if (innerSquareWin) {
        completedPatterns++;
        patternCells.push(innerSquareCells);
      }
      if (outerSquareWin) {
        completedPatterns++;
        patternCells.push(outerSquareCells);
      }
      if (diag1Win && diag2Win) {
        completedPatterns++;
        patternCells.push(xPatternCells);
      }

      const isWinner = completedPatterns >= 3;

      if (isWinner) {
        const winningCells = patternCells.flat();

        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];

        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      } else {
        return { isWinner: false, winningCells: [], status: "lose" };
      }
    }
    case "diagonals": {
      const isWinner = winningDiagonals.length >= 1;
      const winningCells = winningDiagonals.flat();
      const status = isWinner
        ? checkCurrentNumberInPattern(winningCells)
        : "lose";
      return { isWinner, winningCells, status };
    }
    case "x": {
      const isWinner = diag1Win && diag2Win;
      const status = isWinner
        ? checkCurrentNumberInPattern(xPatternCells)
        : "lose";
      return { isWinner, winningCells: xPatternCells, status };
    }
    case "outerSquare": {
      const status = outerSquareWin
        ? checkCurrentNumberInPattern(outerSquareCells)
        : "lose";
      return {
        isWinner: outerSquareWin,
        winningCells: outerSquareCells,
        status,
      };
    }
    case "innerSquare": {
      const status = innerSquareWin
        ? checkCurrentNumberInPattern(innerSquareCells)
        : "lose";
      return {
        isWinner: innerSquareWin,
        winningCells: innerSquareCells,
        status,
      };
    }
    default: {
      let winningCells = [];
      if (winningRows.length >= 1) {
        winningCells.push(...winningRows.flat());
      }
      if (winningColumns.length >= 1) {
        winningCells.push(...winningColumns.flat());
      }
      if (winningDiagonals.length >= 1) {
        winningCells.push(...winningDiagonals.flat());
      }

      const uniqueWinningCells = winningCells.filter(
        (cell, index, self) =>
          index ===
          self.findIndex((c) => c.row === cell.row && c.col === cell.col)
      );

      const isWinner =
        winningRows.length + winningColumns.length + winningDiagonals.length >=
        1;
      const status = isWinner
        ? checkCurrentNumberInPattern(uniqueWinningCells)
        : "lose";
      return { isWinner, winningCells: uniqueWinningCells, status };
    }
  }
}
