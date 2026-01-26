/*******************************************************************************
 * Introduction *
 * 
 *  1) Derive GEDI Level-2B variables.
 * 
 * Last updated: 1/26/2026
 * 
 * Runtime: 21m ~ 38m
 * 
 * Author: Chenyang Wei (chenyangwei.cwei@gmail.com)
 ******************************************************************************/


/*******************************************************************************
 * Modules *
 ******************************************************************************/

var ENA_mod = require(
  "users/ChenyangWei/Public:Modules/LiDAR-Birds/Eastern_North_America.js");


/*******************************************************************************
 * Objects *
 ******************************************************************************/

// Major working directories.
var wd_Main_Str = "projects/wisconsin-gedi/assets/";

// Study period.
var GEDIyears_List = [2019, 2020, 2021, 2022, 2024];

// Growing season.
var startMonth_Num = 5;
var endMonth_Num = 9;

// Area of interest.
var AOI_Geom = ENA_mod.WI_AOI_Geom;


/*******************************************************************************
 * Functions *
 ******************************************************************************/

// Mask GEDI Level-2B data.
var Mask_L2B = function(L2B_Img) {
  
  var qualityMask_Img = L2B_Img.select("l2b_quality_flag")
    .eq(1);
  
  var degradeMask_Img = L2B_Img.select("degrade_flag")
    .eq(0);
  
  // Use GEDI data acquired at night.
  var solarMask_Img = L2B_Img.select("solar_elevation")
    .lt(0);
  
  // High penetration sensitivity.
  var sensitivity_Img = L2B_Img.select("sensitivity");
  
  var sensitivityMask_Img = sensitivity_Img
    .gt(0.95)
    .and(sensitivity_Img.lte(1));
  
  // Full-power beams.
  var beamID_Img = L2B_Img.select("beam");
  
  var fullPowerMask_Img = beamID_Img.eq(5)
    .or(beamID_Img.eq(6))
    .or(beamID_Img.eq(8))
    .or(beamID_Img.eq(11));
  
  // Whether the L2B algorithm is run.
  var l2bAlgorithmMask_Img = L2B_Img
    .select("algorithmrun_flag")
    .eq(1);
  
  // Total canopy cover (total and all intervals: 31 bands).
  var cover_Img = L2B_Img.select("cover.*");
  
  var coverMask_Img = cover_Img
    .gte(0)
    .and(cover_Img.lte(1));
  
  coverMask_Img = coverMask_Img
    .reduce(ee.Reducer.min());
  
  // Plant Area Index (total and all intervals: 31 bands).
  var paiMask_Img = L2B_Img.select("pai.*")
    .gte(0)
    .reduce(ee.Reducer.min());
  
  // Plant Area Volume Density (all intervals: 30 bands).
  var pavdMask_Img = L2B_Img.select("pavd.*")
    .gte(0)
    .reduce(ee.Reducer.min());
  
  // Foliage Height Diversity.
  var fhdMask_Img = L2B_Img.select("fhd_normal")
    .gte(0);
  
  return L2B_Img.updateMask(qualityMask_Img)
    .updateMask(degradeMask_Img)
    .updateMask(solarMask_Img)
    .updateMask(sensitivityMask_Img)
    .updateMask(fullPowerMask_Img)
    .updateMask(l2bAlgorithmMask_Img)
    .updateMask(coverMask_Img)
    .updateMask(paiMask_Img)
    .updateMask(pavdMask_Img)
    .updateMask(fhdMask_Img);
};

// Aggregate the PAVD bins.
var Aggregate_PAVD_bins = function(
  L2B_Img, startBin_Num, endBinInclusive_Num) {
  
  // Derive a List of band names.
  var bandNames_List = ee.List.sequence(startBin_Num, endBinInclusive_Num)
    .map(function(binID_Num){
      
      // Return the band name of each bin.
      return ee.String("pavd_z").cat(ee.Number(binID_Num).toInt());
    });
  
  // Average the PAVD bins.
  var avgPAVD_Img = L2B_Img.select(bandNames_List)
    .reduce(ee.Reducer.mean());
  
  return avgPAVD_Img;
};

// Preprocess the L2B Image.
var Preprocess_L2B = function(L2B_Img) {
  
  // Data filtering.
  L2B_Img = Mask_L2B(L2B_Img);

  // PAVD-bin aggregation.
  var pavd_0_10_Img = Aggregate_PAVD_bins(L2B_Img, 0, 1)
    .rename("pavd_0_10");
  var pavd_10_20_Img = Aggregate_PAVD_bins(L2B_Img, 2, 3)
    .rename("pavd_10_20");
  var pavd_20_35_Img = Aggregate_PAVD_bins(L2B_Img, 4, 6)
    .rename("pavd_20_35");
  var pavd_35_50_Img = Aggregate_PAVD_bins(L2B_Img, 7, 9)
    .rename("pavd_35_50");
  var pavd_gt50_Img = Aggregate_PAVD_bins(L2B_Img, 10, 29)
    .rename("pavd_gt50");

  var aggregated_PAVDbins_Img = ee.Image.cat([
    pavd_0_10_Img,
    pavd_10_20_Img,
    pavd_20_35_Img,
    pavd_35_50_Img,
    pavd_gt50_Img
  ]);
  
  return L2B_Img.select(["cover", "fhd_normal", "pai"])
    .addBands(aggregated_PAVDbins_Img);
};

// Calculate the temporal median variables for each year.
var Calculate_AnnualMedian = function(year_Num) {
  
  // Temporal filtering.
  var annualGEDI_IC = preprocessedL2B_IC.filter(
    ee.Filter.calendarRange({
      start: year_Num,
      field: "year"
    })
  );
  
  // Median calculation.
  var annualMedian_Img = annualGEDI_IC
    .median()
    .setDefaultProjection(GEDIprojection_Prj)
    .clip(studyArea_Geom)
    .toFloat()
    .set({
      Year: year_Num
    });
  
  return annualMedian_Img;
};


/*******************************************************************************
 * Datasets *
 ******************************************************************************/

// Study area geometry.
var studyArea_Geom = ee.Feature(ee.FeatureCollection(
  wd_Main_Str + "Study_Domain/StudyArea_Wisconsin"
).first()).geometry();

// GEDI Level-2B data located within the AOI and
//   collected during the growing season.
var growingSeason_AOI_Filter = ee.Filter.and(
  ee.Filter.bounds(AOI_Geom),
  ee.Filter.calendarRange({
    start: startMonth_Num, 
    end: endMonth_Num, 
    field: "month"
  })
);

var L2B_IC = ee.ImageCollection("LARSE/GEDI/GEDI02_B_002_MONTHLY")
  .filter(growingSeason_AOI_Filter);


/*******************************************************************************
 * 1) Derive GEDI Level-2B variables. *
 ******************************************************************************/

// GEDI data preprocessing.
var preprocessedL2B_IC = L2B_IC
  .map(Preprocess_L2B);

// Extract the projection of the first GEDI Image.
var GEDIprojection_Prj = preprocessedL2B_IC.first()
  .projection();


/*******************************************************************************
 * Results *
 ******************************************************************************/

var output = true; // true OR false.

if (!output) {
  
  // Check the object(s).
  print(
    "GEDIprojection_Prj:",
    GEDIprojection_Prj
  );
  
  // Visualization.
  Map.setOptions("Satellite");
  Map.centerObject(AOI_Geom, 8);
  
  Map.addLayer(AOI_Geom, 
    {
      color: "FFFFFF"
    }, 
    "AOI_Geom");

  Map.addLayer(studyArea_Geom, 
    {
      color: "FFFFFF"
    }, 
    "studyArea_Geom");

  Map.addLayer(preprocessedL2B_IC, 
    {
      bands: ["cover"],
      min: 0,
      max: 1,
      palette: ["0000FF", "FFFFFF", "FF0000"]
    }, 
    "cover");

} else {
  
  // Output to Asset.
  var fileName_Str = "L2B";
  
  var GEDIprojection_PrjInfo = GEDIprojection_Prj.getInfo();
  
  GEDIyears_List.forEach(function(GEDIyear_Num) {
    
    var annualGEDImedian_Img = Calculate_AnnualMedian(GEDIyear_Num);
  
    Export.image.toAsset({
      image: annualGEDImedian_Img, 
      description: fileName_Str + "_" + GEDIyear_Num, 
      assetId: wd_Main_Str
        + "Annual_MedianGEDI/"
        + fileName_Str + "/"
        + fileName_Str + "_" + GEDIyear_Num, 
      region: AOI_Geom, 
      crs: GEDIprojection_PrjInfo.crs,
      crsTransform: GEDIprojection_PrjInfo.transform,
      maxPixels: 1e13
    });
  });
}

