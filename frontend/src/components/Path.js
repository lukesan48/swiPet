const app_name = 'mern-lab-demo-e227abd26079'
exports.buildPath =
function buildPath(route)
{
	if (process.env.NODE_ENV === 'production')
	{
    	return 'https://' + app_name +  '.herokuapp.com/' + route;
	}
	else
	{    	
    	return 'http://localhost:5000/' + route;
	}
}