/**
 * In this pen we create a custom Morionette Region. Instead of simply replacing
 * the contents with a new view when calling show(), we add the new view
 * off-screen and transition the region to show the new view.
 *
 * When the transition is done the region is reset to it's original location.
 */

// Define the Panning Region class
// -------------------------------

// This region relies on Matrix.js (and Point.js) for working with
// transformation matrices.
// 
// http://dl.dropbox.com/u/46070688/js/geom/point.js
// http://dl.dropbox.com/u/46070688/js/geom/matrix.js

var getPrefixedCssProp = function(baseProp) {
  var str = Modernizr.prefixed(baseProp);
  str = str.replace(/([A-Z])/g, function(str,m1){ return '-' + m1.toLowerCase(); }).replace(/^ms-/,'-ms-');
  return str;
};

var PanningRegion = Marionette.Region.extend({

  initialize: function() {
    var transEndEventNames = {
      'WebkitTransition' : 'webkitTransitionEnd',
      'MozTransition'    : 'transitionend',
      'OTransition'      : 'oTransitionEnd',
      'msTransition'     : 'MSTransitionEnd',
      'transition'       : 'transitionend'
    };
    this.transEndEventName = transEndEventNames[ Modernizr.prefixed('transition') ];
    this.transformPropName = getPrefixedCssProp('transform');

    console.log(this.transEndEventName, this.transformPropName);
  },

  // Very similar to show(), but uses css transition class between views
  transitionToView: function(newView, type) {

    var self = this;

    // Do we have a view currently?
    var view = this.currentView;
    if (!view || view.isClosed){
      this.show(newView);
      return;
    }

    Marionette.triggerMethod.call(this, "willTransition", view);

    this.stopListening(newView, 'render');

    // Wait for the new view to render, then initialize a transition to
    // show the new view while hiding the old.
    this.listenTo(newView, 'render', function() {

      // clean up the old listeners, just to ensure we only have 1 active.
      self.$el.off(self.transEndEventName);

      // Move the new view to an off-screen position using transformation matrix
      var translation;

      // Determine the type of transition and build the css transformation.
      if(type === 'slide') {
        translation = 'translateX(100%)';
      }
      else if(type === 'rotate') {
        translation = 'translateX(100%) translateY(100%) rotate(' + ['20', '40', '60', '80', '90'][_.random(0, 4)] + 'deg)';
      }
      else if(type === 'drop') {
        translation = 'translateY(100%)';
      }

      newView.$el.css(self.transformPropName, translation);

      // Add the new view to the dom
      self.$el.append(newView.el);

      // Translate the container to show the new element
      var $background = jQuery('#world-bg');

      // Find the transformation matrix of each element.
      var worldContentMatrix = Matrix.initWithElem(self.$el);
      var worldBgMatrix = Matrix.initWithElem($background);
      var newViewMatrix = Matrix.initWithElem(newView.$el);

      // Turn on the css animations to enable the transition. We do this here, 
      // before the tranision instead of after the transition is complete 
      // because it causes less of a visual 'snap' as the pattern moves.
      self.$el.addClass('animated')
      $background.addClass('animated');

      // Given than we know the container has an identity matrix we can transition
      // by simply inverting the matrix of the new view and appyling it to the parent.
      self.$el.css(self.transformPropName, newViewMatrix.clone().invert().toMatrixString());

      // Let's make sure the background moves to the same place.
      $background.css(self.transformPropName, newViewMatrix.clone().invert().toMatrixString());

      // after transition, clean up by removing the old view, then
      // re-position everything back to a zero-point. There might be a problem
      // relying on the transitionEnd event because there are cases where it
      // does not fire.
      self.$el.on(self.transEndEventName, function () {
        self.$el.off(self.transEndEventName);

        // clean up the old view
        self.close();
        self.currentView = newView;

        // clean up new view and place everything back
        // to a sane starting position, ready for next transition.

        self.$el.removeClass('animated')
        $background.removeClass('animated');

        self.$el.css(self.transformPropName, (new Matrix()).toMatrixString());
        newView.$el.css(self.transformPropName, (new Matrix()).toMatrixString());
        $background.css('webkit-transform', (new Matrix()).toMatrixString());

        // do the things show would normally do after showing a new view
        Marionette.triggerMethod.call(newView, "show");
        Marionette.triggerMethod.call(self, "show", newView);
      });

    });

    newView.render();

  } // end transitionToView

});

// Let's find some images we can randomly choose from
var images = [
  'http://www.beebeography.com/Nature/i-rP8JSCv/0/M/DSC_8183-M.jpg',
  'http://www.beebeography.com/Nature/i-tKvpZDG/0/M/DSC_8216_Fotor-M.jpg',
  'http://www.beebeography.com/Nature/i-Pk9nCCz/0/M/2013-11-09-radner-lake-trees-01-M.jpg',
  'http://www.beebeography.com/Journal/i-hwfrBnq/1/M/2008-10-11_IMG_8087-M.jpg',
  'http://www.beebeography.com/Journal/i-N3c4dBs/0/M/2008-09-28_IMG_7877-M.jpg',
  'http://www.beebeography.com/Journal/i-tkW5Bbc/0/M/IMG_6293-M.jpg'
];

// Define the app and a region to show content
// -------------------------------------------

var App = new Marionette.Application();

App.addRegions({
  worldContent: {
    selector: "#world-content",
    regionType: PanningRegion
  }
});

// Create a module to contain some functionality
// ---------------------------------------------

App.module("SampleModule", function(Mod, App, Backbone, Marionette, $, _){

  // Define a view model
  // -------------------

  var SlideModel = Backbone.Model.extend();

  // Define a view to show
  // ---------------------

  var SlideView = Marionette.ItemView.extend({
    template: '#slideTemplate',
    events: {
      'click button.next-slide': 'slide',
      'click button.next-rotate': 'rotate',
      'click button.next-drop': 'drop',
    },
    slide: function() {
      this.trigger('next', 'slide');
    },
    rotate: function() {
      this.trigger('next', 'rotate');
    },
    drop: function() {
      this.trigger('next', 'drop');
    }
  });

  // Define a controller to run this module
  // --------------------------------------

  var Controller = Marionette.Controller.extend({

    initialize: function(options) {
      this.region = options.region;
    },

    show: function(type) {
      var model = new SlideModel({
        title: 'Panning Region',
        subtitle: 'Powered by MarionetteJS',
        image: images[_.random(0, images.length - 1)]
      });

      var view = new SlideView({
        model: model
      });

      this.region.transitionToView(view, type);

      this.listenTo(view, 'next', function(type) {
        this.show(type);
      });
    }

  });

  // Initialize this module when the app starts
  // ------------------------------------------

  Mod.addInitializer(function(){
    Mod.controller = new Controller({
      region: App.worldContent
    });
    Mod.controller.show();
  });
});

// Start the app
// -------------

App.start();