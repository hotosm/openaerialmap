"""Tests for `stactools.hotosm.oam_metadata_client`."""

import datetime as dt
import logging
from math import ceil

import pytest
import requests
import responses
from responses.matchers import query_param_matcher

from stactools.hotosm.oam_metadata_client import OamMetadataClient


class TestOamMetadataClient:
    """Tests for OamMetadataClient."""

    def test_new(self):
        """Test new() classmethod."""
        client = OamMetadataClient.new()
        assert isinstance(client, OamMetadataClient)

        session = requests.Session()
        client = OamMetadataClient.new(session=session, api_root="test")
        assert client.session is session
        assert client.api_root == "test"

    def make_response_pages(
        self, api_root: str, api_responses: dict, n_per_page: int
    ) -> list[responses.Response]:
        """Create mocked responses from /meta API."""
        pages = ceil(10 / n_per_page)

        resps = []
        for page in range(pages + 1):
            start = n_per_page * page
            end = n_per_page * (page + 1)
            data = {
                "meta": api_responses["meta"],
                "results": api_responses["results"][start:end],
            }
            resps.append(
                responses.get(
                    url=api_root,
                    json=data,
                    match=[query_param_matcher({"page": page + 1}, strict_match=False)],
                )
            )

        return resps

    @pytest.fixture
    def test_client(self) -> OamMetadataClient:
        """Test client."""
        return OamMetadataClient.new(api_root="http://test.test/test")

    @responses.activate
    def test_get_count(
        self, test_client: OamMetadataClient, example_oam_meta_api_response: dict
    ):
        """Test get_count() method."""
        resp = responses.get(
            url=test_client.api_root,
            json=example_oam_meta_api_response,
        )

        count = test_client.get_count()
        assert count == 17737
        assert resp.call_count == 1

    @responses.activate
    def test_get_item(
        self, test_client: OamMetadataClient, example_oam_meta_api_response: dict
    ):
        """Test get_items() method."""
        single_response = example_oam_meta_api_response.copy()
        single_response["results"] = example_oam_meta_api_response["results"][0]
        meta_id = single_response["results"]["_id"]

        resp = responses.get(
            url=f"{test_client.api_root}/{meta_id}",
            json=single_response,
        )

        item = test_client.get_item(meta_id)
        assert item.id == meta_id
        assert resp.call_count == 1

    @responses.activate
    def test_get_items(
        self, test_client: OamMetadataClient, example_oam_meta_api_response: dict
    ):
        """Test get_items() method."""
        resp = responses.get(
            url=test_client.api_root,
            json=example_oam_meta_api_response,
        )

        items = test_client.get_items(raise_on_error=False)
        assert len(items) == 10
        assert resp.call_count == 1

    @responses.activate
    def test_get_items_raises_error(
        self,
        test_client: OamMetadataClient,
        example_oam_meta_api_response: dict,
        caplog,
    ):
        """Test get_items() method raises if metadata cannot be parsed."""
        # Some metadata entries have no acquisition start/end provided
        bad_id = example_oam_meta_api_response["results"][0]["_id"]
        example_oam_meta_api_response["results"][0]["acquisition_start"] = None

        resp = responses.get(
            url=test_client.api_root,
            json=example_oam_meta_api_response,
        )

        with pytest.raises(TypeError, match=r"fromisoformat: argument must be str"):
            test_client.get_items(raise_on_error=True)
        assert resp.call_count == 1
        assert len(caplog.record_tuples) == 1
        assert caplog.record_tuples[0][1] == logging.ERROR
        assert caplog.record_tuples[0][2] == f"Could not parse id={bad_id}"

    @responses.activate
    @pytest.mark.parametrize("n_per_page", [2, 3, 10])
    def test_get_all_items(
        self,
        n_per_page: int,
        test_client: OamMetadataClient,
        example_oam_meta_api_response: dict,
    ):
        """Test get_all_items() method works with different page count sizes."""
        resps = self.make_response_pages(
            api_root=test_client.api_root,
            api_responses=example_oam_meta_api_response,
            n_per_page=n_per_page,
        )

        items = list(test_client.get_all_items(limit=n_per_page))
        assert len(items) == 10
        for resp in resps:
            assert resp.call_count == 1

    @responses.activate
    def test_get_items_uploaded_after(
        self,
        test_client: OamMetadataClient,
        example_oam_meta_api_response_sortby_uploaded_at: dict,
    ):
        """Test getting items uploaded after some datetime."""
        self.make_response_pages(
            api_root=test_client.api_root,
            api_responses=example_oam_meta_api_response_sortby_uploaded_at,
            n_per_page=5,
        )

        uploaded_after = dt.datetime(2017, 1, 1, tzinfo=dt.UTC)
        items = test_client.get_items(uploaded_after=uploaded_after)
        assert all(
            item.uploaded_at is None or item.uploaded_at >= uploaded_after
            for item in items
        )

    @responses.activate
    def test_get_all_items_uploaded_after(
        self,
        test_client: OamMetadataClient,
        example_oam_meta_api_response_sortby_uploaded_at: dict,
    ):
        """Test getting all items uploaded after some datetime."""
        self.make_response_pages(
            api_root=test_client.api_root,
            api_responses=example_oam_meta_api_response_sortby_uploaded_at,
            n_per_page=5,
        )

        uploaded_after = dt.datetime(2017, 1, 1, tzinfo=dt.UTC)
        all_items = list(test_client.get_all_items(uploaded_after=uploaded_after))
        assert all(
            item.uploaded_at is None or item.uploaded_at >= uploaded_after
            for item in all_items
        )

    def test_parse_result_handles_uploaded_at(
        self,
        example_oam_meta_api_response: dict,
        test_client: OamMetadataClient,
    ):
        """Ensure result parsing conditionally includes uploaded_at."""
        result = example_oam_meta_api_response["results"][0]

        result.pop("uploaded_at", None)
        metadata = test_client._parse_result(result)
        assert metadata.uploaded_at is None

        utc_now = dt.datetime.now(dt.UTC)
        result["uploaded_at"] = utc_now.isoformat()
        metadata = test_client._parse_result(result)
        assert metadata.uploaded_at == utc_now
