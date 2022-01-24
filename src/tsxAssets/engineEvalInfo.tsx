import React, { useState } from 'react';

function EngineInfo(props: {
  showMoves: boolean,
  showEval: boolean
}) {
  const [info, setInfo] = useState<any>(null);

  const handleEngineOutput = (event: any) => {
    if (event.detail.score)
      setInfo(event.detail)
  };

  React.useEffect(() => {
    document.addEventListener('engine', handleEngineOutput);

    // cleanup this component
    return () => {
      document.removeEventListener('engine', handleEngineOutput);
    };
  }, []);

  if (info) {
    let evalText = ""
    if (info.score.includes("mate")) {
      if (Number(info.score.split(' ')[1]) === 0) {
        evalText = "Checkmate"
      } else {
        // console.log(parsedLineInfo.score)
        evalText = `${(info.score.split(' ')[1][0] === '-') ? '-' : '+'}M ${Math.abs(Number(info.score.split(' ')[1]))}`
      }
    } else {
      if (info.raw === 'info depth 0 score cp 0') evalText = 'Stalemate'
      else {
        // Show in points
        if (Number(info.score.split(' ')[1]) > 0) evalText += "+"
        evalText += (Number(info.score.split(' ')[1]) / 100).toString()
      }
    }
    if (evalText !== 'Checkmate' && evalText !== 'Stalemate')
      return <div className='engine-info'>
        <h3>Depth: {info.depth}{(props.showEval) ? ' | Eval: ' + evalText : null}</h3>
        <p>Nodes: {info.nodes} | Nps: {info.nps}</p>
        {(props.showMoves) ? <h4>Moves: {(info.pv.length <= 30) ? info.pv : info.pv.slice(0, 25) + "..."}</h4> : null}
      </div>
    else
      return <div className='engine-info'>
        <h3>{evalText}</h3>
      </div>
  }
  else
    return <div className='engine-info'>
      <h3>Loading Engine</h3>
    </div>
}

export default EngineInfo