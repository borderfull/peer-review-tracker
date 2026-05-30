// pages/index.js — redirect root to the static HTML app
export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/app.html',
      permanent: false,
    },
  };
}

export default function Page() {
  return null;
}
