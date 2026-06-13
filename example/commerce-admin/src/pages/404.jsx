
export default function NotFoundPage({ route }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">페이지를 찾을 수 없습니다</h2>
          <div className="panel__sub">{route.pathname}</div>
        </div>
        <a className="btn btn--primary" href="/">
          스토어로
        </a>
      </div>
      <div className="panel__body">
        <div className="help">src/pages에 매칭되는 페이지 파일이 없습니다.</div>
      </div>
    </div>
  );
}
