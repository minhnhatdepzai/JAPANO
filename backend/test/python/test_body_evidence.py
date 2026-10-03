import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from body_evidence import apply_measurement_evidence

class EvidenceTests(unittest.TestCase):
    def test_clear_photo_preserves_uncertainty_without_treating_it_as_measurement(self):
        data=self.sample()
        data['quality']={'fullBodyVisible':True,'headVisible':True,'segmentationAvailable':True,
                         'analysisConfidence':.8,'tiltDeg':0}
        data['estimatedHeight'].update(minCm=155,maxCm=185)
        data['estimatedWeight'].update(minKg=40,maxKg=50,uncertaintyMinKg=32,uncertaintyMaxKg=60)
        value=apply_measurement_evidence(data)
        self.assertEqual(value['estimatedHeight']['valueCm'],170)
        self.assertEqual(value['estimatedWeight']['minKg'],32)
        self.assertEqual(value['estimatedWeight']['maxKg'],60)
        self.assertFalse(value['estimatedWeight']['usableForSizing'])
        self.assertEqual(value['estimatedWeight']['measurementStatus'],'insufficient_evidence')

    def sample(self):
        return {'estimatedHeight':{'valueCm':170,'source':'image_estimate'},'estimatedWeight':{'valueKg':45},'models':{}}

    def test_prior_does_not_become_a_measurement(self):
        value=apply_measurement_evidence(self.sample())
        self.assertIsNone(value['estimatedHeight']['valueCm'])
        self.assertIsNone(value['estimatedWeight']['valueKg'])
        self.assertEqual(value['estimatedGirths'],{})

    def test_measured_150kg_is_preserved_without_population_clipping(self):
        value=apply_measurement_evidence(self.sample(),160,150)
        self.assertEqual(value['estimatedWeight']['valueKg'],150)
        self.assertEqual(value['estimatedHeight']['valueCm'],160)

    def test_scale_reference_only_supports_height(self):
        data=self.sample();data['estimatedHeight']['source']='reference_object'
        value=apply_measurement_evidence(data)
        self.assertEqual(value['estimatedHeight']['valueCm'],170)
        self.assertIsNone(value['estimatedWeight']['valueKg'])

    def test_ood_weight_only_surfaces_when_broad_build_has_three_signals(self):
        for confirmed, expected in ((False, None), (True, 108)):
            data=self.sample()
            data['quality']={'fullBodyVisible':True,'headVisible':True,'segmentationAvailable':True,
                             'analysisConfidence':.9,'tiltDeg':0,
                             'buildCorrection':{'applied':confirmed}}
            data['estimatedWeight']={
                'valueKg':108,'uncertaintyMinKg':88,'uncertaintyMaxKg':128,
                'source':'image_estimate','model':'ansur2-bmi-from-ratios',
                'outOfDistribution':True,
            }
            value=apply_measurement_evidence(data)
            self.assertEqual(value['estimatedWeight']['valueKg'],expected)

    def test_partial_or_seated_photo_returns_low_confidence_ranges(self):
        data=self.sample()
        data.update({
            'quality':{
                'fullBodyVisible':False,'headVisible':True,'feetVisible':False,
                'segmentationAvailable':True,'analysisConfidence':.83,
                'poseConfidence':.87,'tiltDeg':3.4,'coverage':'knee',
            },
            'partialPhotoPrior':{
                'heightCm':161.4,'weightKg':56.6,'bmi':21.7,
                'model':'celeb-fbi-cropped-convnext-tiny-height-bmi',
                'checkpointSha256':'photo-hash',
                'girths':{'bust':87.0,'waist':76.4,'hip':95.3},
                'girthModel':'ansur2-height-bmi-partial-girth-prior',
                'girthCheckpointSha256':'girth-hash',
            },
        })
        value=apply_measurement_evidence(data)
        self.assertEqual(value['measurementStatus'],'partial')
        self.assertEqual(value['estimatedHeight']['valueCm'],161.4)
        self.assertEqual(value['estimatedWeight']['valueKg'],56.6)
        self.assertEqual(value['estimatedGirthRanges']['hip']['valueCm'],95.3)
        self.assertFalse(value['estimatedHeight']['usableForSizing'])
        self.assertFalse(value['estimatedWeight']['usableForSizing'])
        self.assertTrue(value['girthsArePopulationPrior'])
        self.assertLessEqual(value['estimatedWeight']['confidence'],.28)

    def test_partial_prior_does_not_bypass_bad_pose(self):
        data=self.sample()
        data['quality']={'fullBodyVisible':False,'analysisConfidence':.2,
                         'poseConfidence':.2,'tiltDeg':5,'coverage':'knee'}
        data['partialPhotoPrior']={'heightCm':161,'weightKg':57,'model':'test'}
        value=apply_measurement_evidence(data)
        self.assertIsNone(value['estimatedHeight']['valueCm'])
        self.assertIsNone(value['estimatedWeight']['valueKg'])

    def test_seated_pose_uses_partial_prior_even_when_ankles_look_visible(self):
        data=self.sample()
        data.update({
            'quality':{
                'fullBodyVisible':True,'headVisible':True,'feetVisible':True,
                'seatedPose':True,'segmentationAvailable':True,
                'analysisConfidence':.91,'poseConfidence':.83,
                'tiltDeg':24.4,'coverage':'full',
            },
            'partialPhotoPrior':{
                'heightCm':153.4,'weightKg':47.2,'bmi':20.1,
                'model':'celeb-fbi-cropped-convnext-tiny-height-bmi',
            },
        })
        value=apply_measurement_evidence(data)
        self.assertEqual(value['measurementStatus'],'partial')
        self.assertEqual(value['estimatedHeight']['valueCm'],153.4)
        self.assertEqual(value['estimatedWeight']['valueKg'],47.2)
        self.assertFalse(value['estimatedWeight']['usableForSizing'])
