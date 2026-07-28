import { fmtUSD, fmtX, fmtIRR } from '../lib/format.js'

const BRANCH_LABEL = {
  pref: 'pref',
  common: 'common',
  participating: 'pref + part',
  capped: 'capped',
}

export default function OutcomeTable({ rows, years }) {
  return (
    <div className="scroll-x">
      <table className="outcomes">
        <thead>
          <tr>
            <th>Exit</th>
            <th className="num">You get</th>
            <th className="num">MOIC</th>
            <th className="num">IRR ({years}y)</th>
            <th>Via</th>
          </tr>
        </thead>
        {rows.map((row, n) => (
          <tbody key={n} className={row.branch === 'common' ? '' : 'row-pref'}>
            <tr>
              <th scope="row">{fmtUSD(row.exit)}</th>
              <td className="num">{fmtUSD(row.payout)}</td>
              <td className="num strong">{fmtX(row.moic)}</td>
              <td className="num">{fmtIRR(row.irr)}</td>
              <td>
                <span className={`badge badge-${row.branch}`}>{BRANCH_LABEL[row.branch]}</span>
              </td>
            </tr>
            <tr className="formula-row">
              <td colSpan={5}>{row.formula}</td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  )
}
