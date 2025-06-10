// API endpoint to serve image files using our advanced finder
app.get('/api/images-advanced/:type/:name', async (req, res) => {
  try {
    const { type, name } = req.params;
    
    // Find the image using our advanced finder
    const filePath = await findImageFile(type, name);
    
    if (!filePath) {
      return res.status(404).json({ 
        error: 'Image not found',
        message: `Could not find image ${type}/${name} after trying all possible locations`
      });
    }
    
    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    console.error(`Error serving image: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});
