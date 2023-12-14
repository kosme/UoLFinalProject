import json

from django.http import JsonResponse, HttpResponse
from django.core.exceptions import ObjectDoesNotExist
from mongoengine import errors as MongoErrors
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.permissions import IsAuthenticated

from .models import Datas, Doctor, Patient

# Verify that:
# 1. The user making the request is a Doctor
# 2. The user is requesting data from a Patient
# 3. That Doctor is monitoring that Patient


def checkRequestCorrectness(requesterId, dataOwnerId):
    # Check if the user doing the request is an instance of the Doctor model
    try:
        doctor = Doctor.objects.get(user_id=requesterId)
    except ObjectDoesNotExist:
        return False

    # Check if the owner of the requested data is an instance of the Patient model
    try:
        patient = Patient.objects.get(user_id=dataOwnerId)
    except ObjectDoesNotExist:
        return False

    # Check if the patient belongs to that doctor
    if patient.doctor_id != doctor.id:
        return False

    return True


@api_view(['GET'])
def ping(request):
    return HttpResponse(status=200)

# Get the data of a specific event
# This endpoint is used by the medical app


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def event(request, userId):

    if not checkRequestCorrectness(request.user.id, userId):
        return JsonResponse({'events': []})

    try:
        timestamp = request.GET['timestamp']
        try:
            event = Datas.objects.get(
                timestamp=timestamp, userId=userId)
            return JsonResponse({'data': event.data})
        except Datas.DoesNotExist:
            return JsonResponse({'data': []})
    except KeyError:
        return JsonResponse({'data': []})


# Get the timestamps for all the events within a certain time period
# This endpoint is used by the phone app


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def events(request):
    try:
        start = request.GET['start']
        stop = request.GET['stop']
        try:
            eventsData = Datas.objects(
                timestamp__gte=start, timestamp__lte=stop, userId=request.user.id)
        except Datas.DoesNotExist:
            return JsonResponse({'events': []})
        evts = []
        for eventData in eventsData:
            evts.append(eventData.timestamp)
        return JsonResponse({'events': evts})
    except KeyError:
        return JsonResponse({'events': []})

# Store received data
# This endpoint is used by the phone app


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def data(request):
    malformed_json = json.dumps(request.POST)
    malformed_json = malformed_json.replace('"[', '[').replace(']"', ']')
    corrected_json = json.loads(malformed_json)
    print(corrected_json)
    new_record = Datas(
        timestamp=corrected_json['timestamp'], data=corrected_json['data'], userId=request.user.id)
    try:
        new_record.save()
        return HttpResponse(content=new_record.timestamp, status=201)
    except MongoErrors.NotUniqueError:
        return HttpResponse(status=201)
    return HttpResponse(status=400)

# Get all the data for all the events within a certain time period
# This endpoint is used by the medical app


@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def individualData(request, userId):

    if not checkRequestCorrectness(request.user.id, userId):
        return JsonResponse({'events': []})

    try:
        start = request.GET['start']
        stop = request.GET['stop']
        ans = []
        try:
            events = Datas.objects(
                timestamp__gte=start, timestamp__lte=stop, userId=userId)
        except Datas.DoesNotExist:
            return JsonResponse({'events': []})
        for eventData in events:
            ans.append({'timestamp': eventData.timestamp,
                       'data': eventData.data})
        return JsonResponse({'events': ans})
    except KeyError:
        return JsonResponse({'events': []})
