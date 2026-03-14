<html>
<head>
<title>Add New Record in MySQL Database</title>
</head>
<body>
<?php
if(isset($_POST['add']))
{
$dbhost = 'localhost';
$dbuser = 'root';
$dbpass = 'root';
$conn = mysql_connect($dbhost, $dbuser, $dbpass);
if(! $conn )
{
  die('Could not connect: ' . mysql_error());
}

if(! get_magic_quotes_gpc() )
{
   $name = addslashes ($_POST['name']);
   $email = addslashes ($_POST['email']);
}
else
{
   $name = $_POST['name'];
   $email = $_POST['email'];
}

$message = $_POST['message'];
$date = $_POST['message'];

$sql = "INSERT INTO form3 ".
       "(name,email,message,date) ".
       "VALUES('$name', '$email', '$message', NOW())";

mysql_select_db('my_db');
$retval = mysql_query( $sql, $conn );
if(! $retval )
{
  die('Could not enter data: ' . mysql_error());
}
echo "Entered data successfully\n";
mysql_close($conn);
}
else
{
?>
<form method="post" action="<?php $_PHP_SELF ?>">
<table width="400" border="0" cellspacing="1" cellpadding="2">
<tr>
<td width="100">Employee Name</td>
<td><input name="name" type="text" id="name"></td>
</tr>
<tr>
<td width="100">Employee Email Address</td>
<td><input name="email" type="text" id="email-not-req"></td>
</tr>
<tr>
<td width="100">Message</td>
<td><textarea name="message" type="text" id="message"> </textarea> </td>
</tr>
<tr>
<td width="100"> </td>
<td> </td>
</tr>
<tr>
<td width="100"> </td>
<td>
<input name="add" type="submit" id="add" value="Add Employee">
</td>
</tr>
</table>
</form>
<?php
}
?>
</body>
</html>