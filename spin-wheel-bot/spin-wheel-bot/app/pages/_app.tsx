import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

function FestiveFareApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Festive Fare Spin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default FestiveFareApp;
