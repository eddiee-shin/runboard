function CustomError({ statusCode }: { statusCode: number }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column' as const, 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: '#0A0A0A',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>{statusCode || 'Error'}</h1>
      <p style={{ color: '#888' }}>Something went wrong. Please try again.</p>
    </div>
  )
}

CustomError.getInitialProps = ({ res, err }: { res: any; err: any }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default CustomError
