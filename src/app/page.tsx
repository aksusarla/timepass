import App from "@/components/App";

// The whole front end is one static page with hash routes (#movie-guess,
// #imposter), so it runs on GitHub Pages or any static host without a server.
export default function Page() {
  return <App />;
}
