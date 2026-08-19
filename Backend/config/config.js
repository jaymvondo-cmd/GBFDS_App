const {sequelize}=require('sequelize');
const env=require('dotenv');


const sequelize=new sequelize(
        process.env.BD_NAME,
        process.env.BD_PORT,
        process.env.BD_PASSWORD, {
          host:process.env.HOST,
          port:process.env.BD_PORT,
          dialect:mysql,

         }
     );
module.exports=sequelize;








