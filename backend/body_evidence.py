"""Public measurement evidence policy for an uncontrolled single photograph."""


def apply_measurement_evidence(result, user_height=0, user_weight=0):
    # Preserve model hypotheses separately from measured facts. A clear photo
    # can support a rough statistical suggestion, not a calibrated measurement.
    candidates = {key: result.get(key) for key in
                  ('estimatedHeight', 'estimatedWeight', 'estimatedGirthRanges', 'girthSource')}
    quality = result.get('quality') or {}
    partial_prior = result.get('partialPhotoPrior') or None
    usable_photo = (quality.get('fullBodyVisible') and quality.get('headVisible')
                    and quality.get('segmentationAvailable')
                    and quality.get('analysisConfidence', 0) >= .6
                    and quality.get('tiltDeg', 90) <= 12
                    and not quality.get('seatedPose')
                    and not result.get('measurementRowsCutOff'))
    partial_photo = ((not quality.get('fullBodyVisible') or quality.get('seatedPose')) and partial_prior
                     and quality.get('analysisConfidence', 0) >= .35
                     and quality.get('poseConfidence', 0) >= .35
                     and quality.get('tiltDeg', 90) <= 30)
    result['absoluteMeasurementsRestricted'] = True
    height = result['estimatedHeight']
    if user_height > 0:
        result['estimatedHeight'] = dict(valueCm=user_height, minCm=user_height,
            maxCm=user_height, confidence=1.0, source='user_provided', usableForSizing=True)
    elif height.get('source') != 'reference_object':
        result['estimatedHeight'] = dict(valueCm=None, minCm=None, maxCm=None,
            confidence=0.0, source='insufficient_evidence', usableForSizing=False,
            unusableReason='Cần chiều cao đo thật hoặc vật chuẩn cùng mặt phẳng với người.')
    if user_weight > 0:
        result['estimatedWeight'] = dict(valueKg=user_weight, minKg=user_weight,
            maxKg=user_weight, confidence=1.0, source='user_provided', model='user_provided', usableForSizing=True)
    else:
        result['estimatedWeight'] = dict(valueKg=None, minKg=None, maxKg=None,
            confidence=0.0, source='insufficient_evidence', model='insufficient_data', usableForSizing=False,
            unusableReason='Ảnh đơn không đo được khối lượng; hãy nhập cân nặng từ cân.')
    result['estimatedGirths'] = {}
    result['estimatedGirthRanges'] = {}
    result['girthSource'] = 'insufficient_evidence'
    result['rejectedGirths'] = {key:'Thiếu chiều sâu cơ thể và số đo kiểm chứng; hãy dùng thước dây.' for key in ('bust','waist','hip')}
    result['warnings'] = ['Ảnh đơn không đủ bằng chứng để đo cân nặng và vòng ngực/eo/hông. '
        'Có thể tiếp tục thử đồ; số đo nhập tay được ưu tiên.']
    result['models']['weight'] = result['estimatedWeight'].get('model')
    result['models']['girth'] = 'insufficient_evidence'
    if usable_photo:
        for key, unit, supplied in [('estimatedHeight', 'Cm', user_height),
                                     ('estimatedWeight', 'Kg', user_weight)]:
            estimate = candidates[key] or {}
            value = estimate.get('value' + unit)
            build_confirmed = bool((quality.get('buildCorrection') or {}).get('applied'))
            if supplied or value is None or (estimate.get('outOfDistribution') and not build_confirmed):
                continue
            if key == 'estimatedWeight' and quality.get('armsMergedIntoTorso') and not str(estimate.get('model','')).startswith('ansur2'):
                continue
            if key == 'estimatedHeight' and estimate.get('source') == 'reference_object':
                continue
            low = estimate.get('uncertaintyMin' + unit, estimate.get('min' + unit))
            high = estimate.get('uncertaintyMax' + unit, estimate.get('max' + unit))
            if low is None or high is None or not low <= value <= high:
                continue
            result[key] = {**estimate, 'min' + unit: low, 'max' + unit: high,
                           'usableForSizing': False, 'measurementStatus': 'insufficient_evidence',
                           'estimateKind': 'uncalibrated_statistical_suggestion'}
        for key, estimate in (candidates['estimatedGirthRanges'] or {}).items():
            if (quality.get('armsMergedIntoTorso')
                    and not str(estimate.get('model') or '').startswith('ansur2-regressor')):
                continue
            low, high = estimate.get('uncertaintyMinCm'), estimate.get('uncertaintyMaxCm')
            value = estimate.get('valueCm')
            if low is None or high is None or value is None or not low <= value <= high:
                continue
            result['estimatedGirthRanges'][key] = {**estimate, 'minCm': low, 'maxCm': high,
                'usableForSizing': False, 'measurementStatus': 'insufficient_evidence',
                'estimateKind': 'uncalibrated_statistical_suggestion'}
        if result['estimatedGirthRanges']:
            result['girthSource'] = candidates['girthSource']
            result['rejectedGirths'] = {k:v for k,v in result['rejectedGirths'].items()
                                      if k not in result['estimatedGirthRanges']}
        result['warnings'].insert(0, 'Các khoảng hiển thị là dự đoán thống kê tham khảo, chưa được hiệu chuẩn '
            'độ chính xác trên ảnh khách; không phải số đo thật và không tự quyết định size.')
    elif partial_photo:
        # Ảnh ngồi/cắt chân không có chiều dài toàn thân. Dùng checkpoint ảnh
        # thật đã train để vẫn trả một giả thuyết hữu ích, nhưng hạ confidence,
        # nới khoảng sai số và tuyệt đối không cho phép nó tự chọn size.
        coverage = str(quality.get('coverage') or 'partial')
        confidence = {'knee': .28, 'hip': .23, 'shoulder': .19, 'partial': .16}.get(coverage, .18)
        if user_height <= 0:
            height_value = float(partial_prior['heightCm'])
            height_spread = {'knee': 16, 'hip': 19, 'shoulder': 23, 'partial': 26}.get(coverage, 22)
            result['estimatedHeight'] = dict(
                valueCm=height_value, minCm=max(0, round(height_value - 5)),
                maxCm=round(height_value + 5), uncertaintyMinCm=round(height_value - height_spread),
                uncertaintyMaxCm=round(height_value + height_spread), confidence=confidence,
                source='partial_photo_model', model=partial_prior['model'],
                checkpointSha256=partial_prior.get('checkpointSha256'), usableForSizing=False,
                measurementStatus='insufficient_evidence',
                estimateKind='partial_photo_statistical_suggestion')
        if user_weight <= 0:
            weight_value = float(partial_prior['weightKg'])
            weight_spread = max(15.0, weight_value * {'knee': .28, 'hip': .34, 'shoulder': .40, 'partial': .45}.get(coverage, .40))
            result['estimatedWeight'] = dict(
                valueKg=weight_value, minKg=max(0, round(weight_value - 5)),
                maxKg=round(weight_value + 5), uncertaintyMinKg=round(max(0, weight_value - weight_spread)),
                uncertaintyMaxKg=round(weight_value + weight_spread), confidence=confidence,
                source='partial_photo_model', model=partial_prior['model'], bmi=partial_prior.get('bmi'),
                checkpointSha256=partial_prior.get('checkpointSha256'), usableForSizing=False,
                measurementStatus='insufficient_evidence',
                estimateKind='partial_photo_statistical_suggestion')
        result['estimatedGirthRanges'] = {}
        girth_confidence = round(max(.10, confidence - .06), 3)
        for key, value in (partial_prior.get('girths') or {}).items():
            value = float(value)
            spread = max(12.0, value * .16)
            result['estimatedGirthRanges'][key] = dict(
                valueCm=value, minCm=max(0, round(value - 5)), maxCm=round(value + 5),
                uncertaintyMinCm=round(max(0, value - spread)), uncertaintyMaxCm=round(value + spread),
                confidence=girth_confidence, source='partial_population_prior',
                model=partial_prior.get('girthModel'),
                checkpointSha256=partial_prior.get('girthCheckpointSha256'), usableForSizing=False,
                measurementStatus='insufficient_evidence',
                estimateKind='height_bmi_population_suggestion')
        result['girthSource'] = partial_prior.get('girthModel') or 'insufficient_evidence'
        result['girthsArePopulationPrior'] = True
        result['rejectedGirths'] = {}
        result['measurementStatus'] = 'partial'
        result['warnings'] = [
            'Ảnh thiếu toàn thân hoặc đang ngồi: các khoảng là dự đoán thống kê độ tin cậy thấp, '
            'không phải số đo thật và không dùng để tự chọn size.',
            'Chiều cao và BMI đến từ ConvNeXt đã train trên ảnh người thật; ba vòng được suy tiếp '
            'từ prior ANSUR II nên sai số hai tầng đã được nới rộng.',
        ]
    result['models']['weight'] = result['estimatedWeight'].get('model')
    result['models']['girth'] = result['girthSource']
    return result
