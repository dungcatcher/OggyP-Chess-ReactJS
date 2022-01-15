import Board from './board'
import { convertToPosition, convertToChessNotation } from './functions';
import { Pawn } from './pieces';
import { Vector, Teams, PieceCodes } from './types'

async function getJSON(path: string, callback: Function) {
  return callback(await fetch(path).then(r => r.json()));
}

interface GameConstuctorInput {
  fen?: {
    val: string
    meta?: Map<string, string>
  }
  pgn?: string
}

type GameOverType = {
  winner: Teams | "draw"
  by: string
  extraInfo?: string
} | false

interface History {
  board: Board
  text: string
  move: {
    start: Vector
    end: Vector
    type: string[]
    notation: {
      short: string
      long: string
    }
  } | null
}

interface PlayerInfo {
  username: string
  rating: number
}

interface Opening {
  Name: string,
  ECO: string | null
}

class Game {
  static openings: any;
  private _history: History[] = [];
  public shortNotationMoves: string = ''
  public gameOver: GameOverType = false
  public startingFEN: string;
  public metaValues: Map<string, string>;
  public metaValuesOrder: string[];
  public opening: Opening = {
    "Name": "Starting Position",
    "ECO": null
  }
  constructor(input: GameConstuctorInput) {
    getJSON('/assets/openings.json', (data: object) => { Game.openings = data; this.checkForOpening() })
    if (input.pgn) {
      // Parse PGN
      console.log(input.pgn)
      this.startingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      this.metaValues = new Map<string, string>()

      let lines = input.pgn.split('\n')
      const lastLine = (lines.pop() as string)?.split('{')
      let lastLineParsed = lastLine[0]
      for (let i = 1; i < lastLine?.length; i++) {
        const splitExtraComment = lastLine[i].split(') ')
        if (splitExtraComment.length === 2)
          lastLineParsed += splitExtraComment[1]
        else
          lastLineParsed += lastLine[i].split('} ')[1]
      }

      lastLineParsed = lastLineParsed.replace(/\?(!|)/g, '')
      lastLineParsed = lastLineParsed.replace(/\.\.\./g, '.')
      console.log(lastLineParsed)

      const moves = lastLineParsed.split(' ')
      this.metaValuesOrder = []
      if (!moves) return

      lines.forEach(line => {
        if (!line) return // ignore empty lines
        const words = line.split(' ')
        const metaValueName = words[0].replace('[', '')
        this.metaValues.set(metaValueName, line.split('"')[1])
        this.metaValuesOrder.push(metaValueName)
      })

      if (this.metaValues.has('FEN'))
        this.startingFEN = this.metaValues.get('FEN') as string

      let board = new Board(this.startingFEN)

      this._history = [{
        board: new Board(board),
        text: "Starting Position",
        move: null
      }]

      let turn: Teams = 'white'
      for (let i = 0; i < moves.length; i++) {
        const originalPGNmove = moves[i]
        console.log('Before ' + originalPGNmove + ' ' + board.getFen())
        let move = moves[i].replace('+', '').replace('#', '')
        if (!isNaN(Number(move[0]))) {
          if (i === moves.length - 1) {
            const gameOverScoreToWinner = new Map([
              ['1-0', 'white',],
              ['1/2-1/2', 'draw'],
              ['0-1', 'black']
            ])
            const winner = gameOverScoreToWinner.get(move)
            console.log(winner)
            if (winner)
              this.setGameOver({
                winner: winner as Teams | "draw",
                by: 'Unknown'
              })
          }
          continue
        }
        if (move === 'O-O-O' || move === '0-0-0' || move === 'O-O' || move === '0-0') { // O and 0 just to be sure 
          const kingPos = {
            'x': 4,
            'y': (turn === 'white') ? 7 : 0
          }
          const endingPos = Object.assign({}, kingPos)
          endingPos.x = (move === 'O-O' || move === '0-0') ? 6 : 2
          let piece = board.getPos(kingPos)
          if (!piece) throw new Error(`Castle ${move} is illegal. ${board.getFen()}`);
          const moves = piece.getMoves(kingPos, board)
          for (let i = 0; i < moves.length; i++) {
            const checkMove = moves[i]
            if (checkMove.move.x === endingPos.x && checkMove.move.y === endingPos.y) {
              board = new Board(checkMove.board)
              this.newMove({
                board: checkMove.board,
                text: originalPGNmove,
                move: {
                  start: kingPos,
                  end: endingPos,
                  type: checkMove.moveType,
                  notation: {
                    short: originalPGNmove,
                    long: convertToChessNotation(kingPos) + convertToChessNotation(endingPos)
                  }
                }
              })
              break;
            }
          }
        } else if (move[0] === move[0].toLowerCase()) {
          console.log('Pawn Move ' + originalPGNmove + '|' + move)
          // pawn move
          let startingPos: Vector = { 'x': convertToPosition(move[0], 'x') as number, 'y': -1 }
          let endingPos: Vector
          if (move.includes('x'))
            move = move.split('x')[1]
          endingPos = convertToPosition(move) as Vector
          // now we need to find the starting y value
          let moveInfo: History | null = null
          for (let y = 0; y < 8 && !moveInfo; y++) {
            if (y === startingPos.y) continue
            startingPos.y = y
            const piece = board.getPos(startingPos)
            if (piece && piece instanceof Pawn && piece.team === turn) {
              let moves = piece.getMoves(startingPos, board)
              for (let i = 0; i < moves.length; i++) {
                const checkMove = moves[i]
                if (checkMove.move.x === endingPos.x && checkMove.move.y === endingPos.y) {
                  board = new Board(checkMove.board)
                  moveInfo = {
                    board: checkMove.board,
                    text: originalPGNmove,
                    move: {
                      start: startingPos,
                      end: endingPos,
                      type: checkMove.moveType,
                      notation: {
                        short: originalPGNmove,
                        long: convertToChessNotation(startingPos) + convertToChessNotation(endingPos)
                      }
                    }
                  }
                  break;
                }
              }
            }
          }
          if (!moveInfo) throw new Error("No legal pawn move was found. " + board.getFen());
          if (move[2] === '=') {
            moveInfo.board.promote(endingPos, move.split('=')[1].toLowerCase() as PieceCodes, turn)
            if (moveInfo.move)
              moveInfo.move.notation.long += move.split('=')[1].toLowerCase() as string
            board = new Board(moveInfo.board)
          }
          this.newMove(moveInfo)
        } else {
          // other piece move
          move = move.replace('x', '')
          const pieceType = move[0].toLowerCase()
          const endingPos = convertToPosition(move.slice(-2)) as Vector
          const requirementsOptions = move.slice(1, -2)
          let requirements: {
            'x': number | null,
            'y': number | null,
          } = {
            'x': null,
            'y': null,
          }
          for (let j = 0; j < requirementsOptions.length; j++) {
            if (isNaN(Number(requirementsOptions[j])))
              // Letter X
              requirements.x = convertToPosition(requirementsOptions[j], 'x') as number
            else
              // Number Y
              requirements.y = convertToPosition(requirementsOptions[j], 'y') as number
          }
          let pos: Vector = { "x": 0, "y": 0 }
          let foundMove = false
          for (pos.x = 0; pos.x < 8 && !foundMove; pos.x++)
            for (pos.y = 0; pos.y < 8 && !foundMove; pos.y++)
              if (pos.x !== endingPos.x || pos.y !== endingPos.y) {
                if (requirements.x && requirements.x !== pos.x) continue
                if (requirements.y && requirements.y !== pos.y) continue
                let piece = board.getPos(pos)
                if (!piece || piece.team !== turn || piece.code !== pieceType) continue
                let moves = piece.getMoves(pos, board)
                for (let i = 0; i < moves.length; i++) {
                  const checkMove = moves[i]
                  if (checkMove.move.x === endingPos.x && checkMove.move.y === endingPos.y) {
                    foundMove = true
                    board = new Board(checkMove.board)
                    this.newMove({
                      board: checkMove.board,
                      text: originalPGNmove,
                      move: {
                        start: { 'x': pos.x, 'y': pos.y },
                        end: endingPos,
                        type: checkMove.moveType,
                        notation: {
                          short: originalPGNmove,
                          long: convertToChessNotation(pos) + convertToChessNotation(endingPos)
                        }
                      }
                    })
                    break;
                  }
                }
              }
          if (!foundMove) throw new Error("No legal normal move found at " + originalPGNmove + " | " + board.getFen() + " Current turn: " + turn + '');

        }
        turn = (turn === 'white') ? 'black' : 'white' // invert team
        this.gameOver = board.isGameOverFor(turn)
      }
    }
    else if (input.fen) {
      this.metaValuesOrder = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'Variant', 'TimeControl', 'ECO', 'Opening']
      if (input.fen.meta)
        this.metaValues = input.fen.meta
      else {
        const currentDate = new Date()
        this.metaValues = new Map([
          ['Event', '?'],
          ['Site', 'https://chess.oggyp.com'],
          ['Date', currentDate.getFullYear() + '.' + currentDate.getMonth() + '.' + currentDate.getDate()],
          ['Round', '?'],
          ['White', '?'],
          ['Black', '?'],
          ['Result', '*'],
          ['Variant', 'Standard'],
          ['TimeControl', '-'],
          ['ECO', '?'],
          ['Opening', '?']
        ])
      }
      this._history = [{
        board: new Board(input.fen.val),
        text: "Starting Position",
        move: null
      }]
      this.startingFEN = input.fen.val
    } else
      throw (new Error("You must specify either a FEN or PGN to track game history."))
  }

  checkForOpening(): void {
    if (!Game.openings) return
    const moves = this.shortNotationMoves.split(' ')
    for (let i = 0; i < moves.length; i++) {
      const opening = Game.openings[moves.slice(0, i).join(' ')]
      if (!opening) continue
      this.metaValues.set('Opening', opening.Name)
      this.metaValues.set('ECO', opening.ECO)
      this.opening = opening as Opening
    }
  }

  getPlayerInfo(): {
    white: PlayerInfo
    black: PlayerInfo
  } | null {
    if (this.metaValues.has('White') && this.metaValues.has('Black')) {
      let ratings = {
        white: (this.metaValues.has('WhiteElo')) ? Number(this.metaValues.get('WhiteElo')) : 0,
        black: (this.metaValues.has('BlackElo')) ? Number(this.metaValues.get('BlackElo')) : 0
      }
      return {
        white: {
          username: this.metaValues.get('White') as string,
          rating: ratings.white
        },
        black: {
          username: this.metaValues.get('Black') as string,
          rating: ratings.black
        }
      }
    }
    return null
  }

  setGameOver(gameOver: GameOverType) {
    this.gameOver = gameOver
    if (this.gameOver) {
      const gameOverWinTypes = {
        'white': '1-0',
        'draw': '1/2-1/2',
        'black': '0-1'
      }
      if (this.metaValues.has('Result'))
        this.metaValues.set('Result', gameOverWinTypes[this.gameOver.winner])
    }
  }

  getMoveCount(): number {
    return this._history.length - 1
  }

  getMove(moveNum: number): History {
    return this._history[moveNum]
  }

  getLatest(): History {
    return this._history[this.getMoveCount()]
  }

  isGameOver(): GameOverType {
    const gameOverInfo = this.getLatest().board.isGameOverFor(this.getLatest().board.getTurn('next'))
    if (gameOverInfo) {
      const gameOverWinTypes = {
        'white': '1-0',
        'draw': '1/2-1/2',
        'black': '0-1'
      }
      const gameOverType = gameOverWinTypes[gameOverInfo.winner]
      if (this.metaValues.has('Result'))
        this.metaValues.set('Result', gameOverType)
      this.gameOver = gameOverInfo
    }
    return gameOverInfo
  }
  
  doMove(startPos: Vector, endPos: Vector, promotion: PieceCodes | undefined = undefined): boolean {
    const latestBoard = this.getLatest().board
    const piece = latestBoard.getPos(startPos)
    if (!piece) return false
    if (piece.team !== latestBoard.getTurn('next')) return false
    const moves = piece.getMoves(startPos, latestBoard)
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]
      if (move.move.x !== endPos.x || move.move.y !== endPos.y) continue
      const newBoard = new Board(move.board)
      if (promotion) {
        newBoard.promote(endPos, promotion, newBoard.getTurn('prev'))
      }
      const isGameOver = newBoard.isGameOverFor(newBoard.getTurn('next'))
      const shortNotation = Board.getShortNotation(startPos, endPos, move.moveType, latestBoard, (isGameOver && isGameOver.by === 'checkmate') ? "#" : ((newBoard.inCheck(newBoard.getTurn('next')) ? '+' : '')), promotion)
      this.newMove({
        board: newBoard,
        text: shortNotation,
        move: {
          start: startPos,
          end: endPos,
          type: move.moveType,
          notation: {
            short: shortNotation,
            long: convertToChessNotation(startPos) + convertToChessNotation(endPos) + ((promotion) ? promotion : '')
          }
        }
      })
      this.setGameOver(isGameOver)
      return true
    }
    return false
  }
  
  newMove(move: History) {
    this._history.push(move)

    let i = this.getMoveCount()
    const moveInfo = move.move
    if (moveInfo) {
      if (i % 2 === 1) {
        this.shortNotationMoves += ((i !== 1) ? ' ' : '') + ((i - 1) / 2 + 1) + '.'
      }
      this.shortNotationMoves += ' ' + moveInfo.notation.short
    }

    if (!Game.openings) return
    const opening: { Name: string, ECO: string } = Game.openings[this.shortNotationMoves]
    if (this.getMoveCount() < 25 && opening) {
      this.metaValues.set('Opening', opening.Name)
      this.metaValues.set('ECO', opening.ECO)
      this.opening = opening as Opening
    }

  }

  getPGN(): string {
    let pgn: string = ''
    this.metaValuesOrder.forEach(value => {
      pgn += `[${value} "${this.metaValues.get(value)}"]\n`
    })
    pgn += '\n' + this.shortNotationMoves
    const gameOverWinTypes = {
      'white': '1-0',
      'draw': '1/2-1/2',
      'black': '0-1'
    }
    if (this.gameOver) pgn += ' ' + gameOverWinTypes[this.gameOver.winner]
    return pgn
  }

  // Returns the moves in long notation from the starting position
  getMovesTo(halfMoveNum: number): string[] {
    let moves: string[] = []
    for (let i = 0; i <= halfMoveNum; i++) {
      const move = this._history[i].move
      if (move)
        moves.push(move.notation.long)
    }
    return moves
  }
}

export default Game