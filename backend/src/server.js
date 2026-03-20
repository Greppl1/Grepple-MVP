const app = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`AAO Settlement API running on port ${PORT}`);
});
