// Vercel serverless function to fetch recent events
// TEMPORARY: Returning empty array until we fix the shell_command approach
// TODO: Implement proper database query method

export default async function (req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { app_name } = req.query;

  if (!app_name) {
    return res.status(400).json({ error: 'app_name is required' });
  }

  // TEMPORARY: Return empty array to prevent errors
  // The shell_command approach is failing with 500 errors
  // We need to implement a different approach (REST sensor, Python script, or fix template sensors)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(200).json({ events: [] });
}

