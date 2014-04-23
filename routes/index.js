
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Title', subtitle: 'Subtitle', image: 'Image' });
};

exports.pan = function(req, res){
  res.render('index-panning-region', { title: 'Title', subtitle: 'Subtitle', image: 'Image' });
};