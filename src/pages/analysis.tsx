import '../css/index.scss';
import '../css/chess.scss';
import '../svg/assets.scss'
import Game from '../game'

console.info("OggyP is awesome!")

function AnalysisPage() {

  const urlParams = new URLSearchParams(window.location.search);

  let pgn: string = ''
  let startingFen: string | undefined = undefined
  if (urlParams.has('pgn'))
    pgn = (urlParams.get('pgn') as string).replace(/_/g, ' ')
  if (urlParams.has('fen'))
    startingFen = (urlParams.get('fen') as string).replace(/_/g, ' ')

  if (startingFen)
    pgn = `[FEN "${startingFen}"]\n\n` + pgn

  console.log(pgn)

  return <Game
    team='any'
    allowMoving={true}
    allowPreMoves={false}
    pgn={(pgn) ? pgn : undefined}
    pgnAndFenChange={true}
  />
}

export default AnalysisPage