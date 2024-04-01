const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de AWS SDK
AWS.config.update({
  // accessKeyId: 'TU_ACCESS_KEY_ID',
  // secretAccessKey: 'TU_SECRET_ACCESS_KEY',
  region: 'us-east-1' // Por ejemplo: 'us-west-1'
});

// Crear un nuevo objeto S3
const s3 = new AWS.S3();

// Configuración de la conexión a la instancia principal
const mainPool = new Pool({
  user: 'masterauroradb',
  host: 'chal-0000-chal-prod-00-aurora-challengedatabase.cluster-cs6lxkji1r2g.us-east-1.rds.amazonaws.com',
  database: 'challengedatabase',
  password: '.8W=pmR?4KqJ*-7^', //qsEoQdhukPiTUeh0wCoZ
  port: 5432,
  ssl: {
    required: true,
    rejectUnauthorized: false
  }
});

// Configuración de la conexión a la réplica de lectura
const readReplicaPool = new Pool({
  user: 'masterauroradb',
  host: 'chal-0000-chal-prod-00-aurora-challengedatabase.cluster-ro-cs6lxkji1r2g.us-east-1.rds.amazonaws.com',
  database: 'challengedatabase',
  password: '.8W=pmR?4KqJ*-7^',
  port: 5432,
  ssl: {
    required: true,
    rejectUnauthorized: false
  }
});

function esConsultaSeguraParaReplica(consulta) {
  // Convertimos la consulta a minúsculas para facilitar la comparación
  const consultaEnMinusculas = consulta.toLowerCase();

  // Verificamos si la consulta es un SELECT
  const esSelect = consultaEnMinusculas.trim().startsWith('select');

  // Verificamos si la consulta es de solo lectura
  const soloLectura = !/insert|update|delete|create|drop|alter/.test(consultaEnMinusculas);

  // Si es un SELECT y es de solo lectura, consideramos que es segura para la réplica
  return esSelect && soloLectura;
}

const contextPath = "api/v1";

// HealthCheck
app.get(`/${contextPath}/health_check`, (req, res) => {
    res.status(200).send("It's Work!");
});


// Ruta get user
app.get(`/${contextPath}/user`, async (req, res) => {
  try {
    let pool;
    const consulta = "SELECT * FROM public.user where first_name = 'Willy'"; // Tu consulta SELECT aquí

    if (esConsultaSeguraParaReplica(consulta)) {
      pool = readReplicaPool; // Utiliza la réplica de lectura
    } else {
      pool = mainPool; // Utiliza la instancia principal
    }

    const client = await pool.connect();
    const result = await client.query(consulta);
    const datos = result.rows;
    client.release();
    res.send(datos);
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// Ruta post user
app.post(`/${contextPath}/user`, async (req, res) => {
  try {
    let pool;
	const datos = req.body;
    const consulta = "INSERT into public.user (first_name, last_name, email, gender, address, ip_address) values ('"+datos.first_name+"','"+datos.laste_name+"','"+datos.email+"','"+datos.gender+"','"+datos.address+"','"+datos.ip_address+"')"; // Tu consulta SELECT aquí

    if (esConsultaSeguraParaReplica(consulta)) {
      pool = readReplicaPool; // Utiliza la réplica de lectura
    } else {
      pool = mainPool; // Utiliza la instancia principal
    }

    const client = await pool.connect();
    const result = await client.query(consulta);
    // const datos = result.rows;
    client.release();
    //res.send(datos);
    res.status(200).send("User created.");
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// En tu ruta para obtener la imagen de un usuario
app.get(`/${contextPath}/image`, (req, res) => {

  const bucket = 'nat-challenge-bucket/images';
  const key = 'test_challenge.jpeg';

  // Configurar parámetros para generar una URL firmada con un tiempo de expiración (por ejemplo, 5 minutos)
  const params = {
    Bucket: bucket,
    Key: key,
  };

  s3.getObject(params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al obtener la imagen');
    }

    // Establecer los encabezados de la respuesta para la imagen
    res.setHeader('Content-Type', data.ContentType);
    res.send(data.Body);
  });
});


// Escuchar en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
