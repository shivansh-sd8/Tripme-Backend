// Serve frontend static files
router.use(express.static(path.join(__dirname, '../../frontend/out')));

// Serve frontend for all routes (SPA)
router.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/out/index.html'));
});