import Papa from 'papaparse';
fetch('https://docs.google.com/spreadsheets/d/1FaCHHOmhR66_04sa_XcdxmX3A5qdOVWZHHtpHThz5Ys/gviz/tq?tqx=out:csv&sheet=LOLA')
  .then(r => r.text())
  .then(t => {
    const p = Papa.parse(t, {header: false});
    console.log(p.data.slice(0, 5));
  });
