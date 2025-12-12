/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var centroid_Geom = 
    /* color: #98ff00 */
    /* shown: false */
    ee.Geometry.Point([-88.5156479853493, 45.551684609647054]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
// Create a buffer around the randomly picked point.
var bufferRadius_Num = 3e4;

var buffer_Geom = centroid_Geom.buffer(bufferRadius_Num);

// Determine a ROI based on the created buffer.
var ROI_Geom = buffer_Geom.bounds();

Map.setOptions("HYBRID");
Map.centerObject(centroid_Geom, 10);
Map.addLayer(ROI_Geom, {color: "FFFFFF"}, "ROI");

// Select a time period.
var start_Date = ee.Date.fromYMD(2022, 1, 1);
var end_Date = start_Date.advance(1, "year");

// Prepare the Satellite Embedding dataset.
var embeddings_IC = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL");

var embeddingsFiltered_IC = embeddings_IC
  .filter(ee.Filter.date(start_Date, end_Date))
  .filter(ee.Filter.bounds(ROI_Geom));

// Extract the projection of the first band of the first Image.
var embeddingsProjection_Prj = ee.Image(embeddingsFiltered_IC.first())
  .select(0).projection();

print("Embedding projection:", embeddingsProjection_Prj);

// Set the projection of the mosaic to the extracted projection.
var embeddingsImage_Img = embeddingsFiltered_IC.mosaic()
  .setDefaultProjection(embeddingsProjection_Prj);

// Prepare the GEDI L4A mosaic.
var gedi_IC = ee.ImageCollection("LARSE/GEDI/GEDI04_A_002_MONTHLY");

// Function to select the highest quality GEDI data.
var qualityMask = function(image) {
  return image.updateMask(image.select("l4_quality_flag").eq(1))
      .updateMask(image.select("degrade_flag").eq(0));
};

// Function to mask unreliable GEDI measurements
//   with a relative standard error > 50%
//   (agbd_se / agbd > 0.5).
var errorMask = function(image) {
  var relative_se = image.select("agbd_se")
    .divide(image.select("agbd"));
  
  return image.updateMask(relative_se.lte(0.5));
};

// Function to mask GEDI measurements on slopes > 30%.
var slopeMask = function(image) {
  // Use Copernicus GLO-30 DEM for calculating slope
  var glo30_IC = ee.ImageCollection("COPERNICUS/DEM/GLO30");

  var glo30Filtered_IC = glo30_IC
    .filter(ee.Filter.bounds(ROI_Geom))
    .select("DEM");

  // Extract the projection.
  var demProj_Prj = glo30Filtered_IC.first().select(0).projection();

  // The dataset consists of individual images,
  //   create a mosaic and set the projection.
  var elevation_Img = glo30Filtered_IC.mosaic().rename("dem")
    .setDefaultProjection(demProj_Prj);

  // Compute the slope.
  var slope_Img = ee.Terrain.slope(elevation_Img);

  return image.updateMask(slope_Img.lt(30));
};

var gediFiltered_IC = gedi_IC
  .filter(ee.Filter.date(start_Date, end_Date))
  .filter(ee.Filter.bounds(ROI_Geom));

var gediProjection_Prj = ee.Image(gediFiltered_IC.first())
  .select("agbd").projection();

var gediProcessed_IC = gediFiltered_IC
  .map(qualityMask)
  .map(errorMask)
  .map(slopeMask);

var gediMosaic_Img = gediProcessed_IC.mosaic()
  .select("agbd").setDefaultProjection(gediProjection_Prj);

print("GEDI projection:", gediProjection_Prj);

// Visualize the GEDI Mosaic.
var gediVis_Dict = {
  min: 0,
  max: 200,
  palette: "#edf8fb, #b2e2e2, #66c2a4, #2ca25f, #006d2c",
  bands: ["agbd"]
};

Map.addLayer(gediMosaic_Img, gediVis_Dict, "GEDI L4A (Filtered)", false);

// Choose the grid size and projection.
var gridScale_Num = 100;
var gridProjection_Prj = ee.Projection("EPSG:3857")
  .atScale(gridScale_Num);

// Create a stacked Image with predictor and response variables.
var stacked_Img = embeddingsImage_Img.addBands(gediMosaic_Img);

//  Set the resampling mode.
var stacked_Img = stacked_Img.resample("bilinear");

// Aggregate pixels with "mean" statistics.
var stackedResampled_Img = stacked_Img
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 1024
  })
  .reproject({
    crs: gridProjection_Prj
});

// As larger GEDI pixels contain masked original
//   pixels, it has a transparency mask.
//   We update the mask to remove the transparency.
var stackedResampled_Img = stackedResampled_Img
  .updateMask(stackedResampled_Img.mask().gt(0));

// Export the stacked Image.
var exportFolder_Str = "projects/wisconsin-gedi/assets/Testing/";
var mosaicExportImage_Str = "SE_GEDI_Stacked";
var mosaicExportImagePath_Str = exportFolder_Str + mosaicExportImage_Str;

if (false) {
  Export.image.toAsset({
    image: stackedResampled_Img,
    description: mosaicExportImage_Str,
    assetId: mosaicExportImagePath_Str,
    region: ROI_Geom,
    scale: gridScale_Num,
    maxPixels: 1e13
  }); // 4 mins.
}

// Use the exported asset.
var stackedResampled_Img = ee.Image(mosaicExportImagePath_Str);

print(
  "Stacked image:",
  stackedResampled_Img.bandTypes(),
  stackedResampled_Img.projection().crs(),
  stackedResampled_Img.projection().nominalScale()
);

// Extract training features.
//   Create a class band from the GEDI mask and use stratifiedSample()
//   to ensure we sample from the non-masked pixels.
var predictorNames_List = embeddingsImage_Img.bandNames();
var responseName_Str = gediMosaic_Img.bandNames().get(0);

print("Predictors:", predictorNames_List);
print("Response:", responseName_Str);

var predictors_Img = stackedResampled_Img.select(predictorNames_List);
var response_Img = stackedResampled_Img.select([responseName_Str]);

Map.addLayer(response_Img, gediVis_Dict, "GEDI L4A (Resampled)", true);

var classMask_Img = response_Img.mask().toInt().rename("class");

var numSamples_Num = 1e4;

// We set classPoints to [0, numSamples_Num].
//   This will give us 0 points for class 0 (masked areas)
//   and numSamples_Num points for class 1 (non-masked areas).
var training_FC = stackedResampled_Img.addBands(classMask_Img)
  .stratifiedSample({
    numPoints: numSamples_Num,
    classBand: "class",
    region: ROI_Geom,
    scale: gridScale_Num,
    classValues: [0, 1],
    classPoints: [0, numSamples_Num],
    dropNulls: true,
    tileScale: 16,
    geometries: true
});

var trainingName_Str = "Training_Observations";

if (false) {
  Export.table.toAsset({
    collection: training_FC, 
    description: trainingName_Str, 
    assetId: exportFolder_Str + trainingName_Str
  }); // 1 min.
}

// Use the exported asset.
var training_FC = ee.FeatureCollection(
  exportFolder_Str + trainingName_Str
);

print("Number of observations sampled:", training_FC.size());
print("Training observation example:", training_FC.first());

Map.addLayer(training_FC, {color: "0000FF"}, "Training observations", false);

// Train a regression model.
//   Use the RandomForest classifier and set the
//   output mode to REGRESSION.
var RF_model = ee.Classifier.smileRandomForest(100)
  .setOutputMode("REGRESSION")
  .train({
    features: training_FC,
    classProperty: responseName_Str,
    inputProperties: predictorNames_List
  });

// Get model's predictions for training samples.
var predicted_FC = training_FC.classify({
  classifier: RF_model,
  outputName: "agbd_predicted"
});

// Calculate RMSE.
var calculateRmse = function(input_FC) {
    var observed_Arr = ee.Array(
      input_FC.aggregate_array("agbd"));
    
    var predicted_Arr = ee.Array(
      input_FC.aggregate_array("agbd_predicted"));
    
    var rmse_Num = observed_Arr.subtract(predicted_Arr).pow(2)
      .reduce(ee.Reducer.mean(), [0]).sqrt().get([0]);
    
    return rmse_Num;
};

var RMSE_Num = calculateRmse(predicted_FC);

print("RMSE (Mg/ha):", RMSE_Num.round()); // 60.92.

// Create a plot of observed vs. predicted values.
var comparison_Chart = ui.Chart.feature.byFeature({
  features: predicted_FC.limit(5e3).select(["agbd", "agbd_predicted"]),
  xProperty: "agbd",
  yProperties: ["agbd_predicted"],
}).setChartType("ScatterChart")
  .setOptions({
    title: "Aboveground Biomass Density (Mg/Ha)",
    dataOpacity: 0.5,
    hAxis: {"title": "Observed"},
    vAxis: {"title": "Predicted"},
    legend: {position: "right"},
    series: {
      0: {
        visibleInLegend: false,
        color: "#0571b0",
        pointSize: 3,
        pointShape: "circle",
      },
    },
    trendlines: {
      0: {
        type: "linear",
        color: "#ca0020",
        lineWidth: 1,
        pointSize: 0,
        labelInLegend: "Trend line",
        visibleInLegend: true,
        showR2: true
      }
    },
    chartArea: {left: 100, bottom: 100, width: "50%"}
  });

print(comparison_Chart);

// Generate predictions for unknown locations.
//   Set the band name of the output image as "agbd".
var predictedAGBD_Img = stackedResampled_Img.classify({
  classifier: RF_model,
  outputName: "agbd"
});

var predictedExportImage_Str = "Predicted_AGBD";
var predictedExportImagePath_Str = exportFolder_Str 
  + predictedExportImage_Str;

if (false) {
  Export.image.toAsset({
    image: predictedAGBD_Img,
    description: predictedExportImage_Str,
    assetId: predictedExportImagePath_Str,
    region: ROI_Geom,
    scale: gridScale_Num,
    maxPixels: 1e13
  }); // 2 mins.
}

var predictedAGBD_Img = ee.Image(predictedExportImagePath_Str);

print(
  "Predicted AGBD:",
  predictedAGBD_Img.bandTypes(),
  predictedAGBD_Img.projection().crs(),
  predictedAGBD_Img.projection().nominalScale()
);

Map.addLayer(ROI_Geom, {color: "FFFFFF"}, "ROI");

// Dark green indicates high values of predicted biomass density.
Map.addLayer(predictedAGBD_Img, gediVis_Dict, "Predicted AGBD", false);

// GEDI AGBD data is processed only for certain landcovers
//   from Plant Functional Types (PFT) classification:
//   https://doi.org/10.1029/2022EA002516

// Use ESA WorldCover v200 product to
//   select landcovers representing vegetated areas.
var worldcover_Img = ee.ImageCollection("ESA/WorldCover/v200").first();

// Aggregate pixels to the same grid as other dataset with "mode" value
//   (i.e. The landcover with highest occurrence within the grid).
var worldcoverResampled_Img = worldcover_Img
  .reduceResolution({
    reducer: ee.Reducer.mode(),
    maxPixels: 1024
  })
  .reproject({
    crs: gridProjection_Prj
});

// Select grids for the following classes
// | Class Name | Value |
// | Forests    | 10    |
// | Shrubland  | 20    |
// | Grassland  | 30    |
// | Cropland   | 40    |
// | Mangroves  | 95    |
var landCoverMask_Img = worldcoverResampled_Img.eq(10)
    .or(worldcoverResampled_Img.eq(20))
    .or(worldcoverResampled_Img.eq(30))
    .or(worldcoverResampled_Img.eq(40))
    .or(worldcoverResampled_Img.eq(95));

var predictedAGBD_Masked_Img = predictedAGBD_Img
  .updateMask(landCoverMask_Img);

Map.addLayer(predictedAGBD_Masked_Img, gediVis_Dict, "Predicted AGBD (Masked)");

// The units of GEDI AGBD values are megagrams per hectare (Mg/ha).
//   Multiply each pixel by its area in hectares and sum their values
//   to get the total AGB of ROI.
var pixelAreaHa_Img = ee.Image.pixelArea().divide(10000);
var predictedAGB_Img = predictedAGBD_Masked_Img.multiply(pixelAreaHa_Img);

var stats_Dict = predictedAGB_Img.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: ROI_Geom,
  scale: gridScale_Num,
  maxPixels: 1e13,
  tileScale: 16
});

// print(stats_Dict);

// Result is a Dictionary with key for each band.
var totalAGB_Num = stats_Dict.getNumber("agbd").round();

print("Total AGB of ROI in 2022 (Mg):", totalAGB_Num);